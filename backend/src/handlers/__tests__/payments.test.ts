import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';

vi.mock('../../lib/db.js', () => {
	const db = {
		checkout: { findUnique: vi.fn(), updateMany: vi.fn(), findUniqueOrThrow: vi.fn() },
		order: { updateMany: vi.fn() },
		coupon: { update: vi.fn() },
		$transaction: vi.fn()
	};
	db.$transaction.mockImplementation((fn: (tx: typeof db) => unknown) => fn(db));
	return { default: db };
});

import prisma from '../../lib/db.js';
import { eventChecksum } from '../../lib/wompi.js';
import { wompiWebhook } from '../payments.js';

const SECRET = 'test_events_secret';
const CHECKOUT_ID = '3f1c2a4e-8b9d-4c1e-9f2a-1b2c3d4e5f60';

function wompiEvent(status: string, amountInCents = 3_550_000) {
	const event = {
		event: 'transaction.updated',
		data: {
			transaction: {
				id: 'tx-1',
				reference: CHECKOUT_ID,
				amount_in_cents: amountInCents,
				status,
				payment_method_type: 'NEQUI'
			}
		},
		timestamp: 1790000000,
		signature: {
			properties: ['transaction.id', 'transaction.status', 'transaction.amount_in_cents'],
			checksum: ''
		}
	};
	event.signature.checksum = eventChecksum(event, SECRET);
	return event;
}

async function post(body: unknown): Promise<APIGatewayProxyResult> {
	const event = { body: JSON.stringify(body), headers: {} } as unknown as APIGatewayProxyEvent;
	return (await wompiWebhook(event, {} as Context, () => {})) as APIGatewayProxyResult;
}

const checkout = (overrides: Record<string, unknown> = {}) => ({
	id: CHECKOUT_ID,
	total: 35500,
	couponId: 7,
	discount: 2000,
	paymentStatus: 'awaiting_payment',
	...overrides
});

describe('wompiWebhook', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		process.env.WOMPI_EVENTS_SECRET = SECRET;
		vi.mocked(prisma.checkout.updateMany).mockResolvedValue({ count: 1 });
	});

	it('answers 401 to a bad checksum and touches nothing', async () => {
		const event = wompiEvent('APPROVED');
		event.data.transaction.amount_in_cents = 100; // tampered after signing

		const response = await post(event);

		expect(response.statusCode).toBe(401);
		expect(prisma.checkout.findUnique).not.toHaveBeenCalled();
	});

	it('marks APPROVED paid and queues its orders, and a redelivery changes nothing', async () => {
		vi.mocked(prisma.checkout.findUnique).mockResolvedValueOnce(checkout() as never);

		expect((await post(wompiEvent('APPROVED'))).statusCode).toBe(200);
		expect(prisma.checkout.updateMany).toHaveBeenCalledWith({
			where: { id: CHECKOUT_ID, paymentStatus: 'awaiting_payment' },
			data: expect.objectContaining({
				paymentStatus: 'paid',
				wompiTxId: 'tx-1',
				paymentMethod: 'NEQUI'
			})
		});
		expect(prisma.order.updateMany).toHaveBeenCalledWith({
			where: { checkoutId: CHECKOUT_ID },
			data: { status: 'pending' }
		});
		expect(prisma.coupon.update).not.toHaveBeenCalled();

		vi.clearAllMocks();
		vi.mocked(prisma.checkout.findUnique).mockResolvedValueOnce(
			checkout({ paymentStatus: 'paid' }) as never
		);

		expect((await post(wompiEvent('APPROVED'))).statusCode).toBe(200);
		expect(prisma.checkout.updateMany).not.toHaveBeenCalled();
		expect(prisma.order.updateMany).not.toHaveBeenCalled();
	});

	it('re-takes the budget when a failed checkout is approved late', async () => {
		vi.mocked(prisma.checkout.findUnique).mockResolvedValueOnce(
			checkout({ paymentStatus: 'payment_failed' }) as never
		);

		await post(wompiEvent('APPROVED'));

		expect(prisma.coupon.update).toHaveBeenCalledWith({
			where: { id: 7 },
			data: { budgetRemaining: { decrement: 2000 } }
		});
	});

	it('fails a DECLINED checkout and credits the coupon budget back', async () => {
		vi.mocked(prisma.checkout.findUnique).mockResolvedValueOnce(checkout() as never);
		vi.mocked(prisma.checkout.findUniqueOrThrow).mockResolvedValueOnce({
			couponId: 7,
			discount: 2000
		} as never);

		expect((await post(wompiEvent('DECLINED'))).statusCode).toBe(200);
		expect(prisma.checkout.updateMany).toHaveBeenCalledWith({
			where: { id: CHECKOUT_ID, paymentStatus: 'awaiting_payment' },
			data: { paymentStatus: 'payment_failed' }
		});
		expect(prisma.order.updateMany).toHaveBeenCalledWith({
			where: { checkoutId: CHECKOUT_ID },
			data: { status: 'payment_failed' }
		});
		expect(prisma.coupon.update).toHaveBeenCalledWith({
			where: { id: 7 },
			data: { budgetRemaining: { increment: 2000 } }
		});
	});

	it('ignores an amount that does not match the checkout total', async () => {
		vi.mocked(prisma.checkout.findUnique).mockResolvedValueOnce(checkout() as never);

		expect((await post(wompiEvent('APPROVED', 100))).statusCode).toBe(200);
		expect(prisma.checkout.updateMany).not.toHaveBeenCalled();
	});
});
