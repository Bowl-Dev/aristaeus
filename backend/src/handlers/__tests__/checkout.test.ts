import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';

vi.mock('../../lib/db.js', () => {
	const db = {
		storeConfig: { findFirst: vi.fn() },
		ingredient: { findMany: vi.fn() },
		coupon: { findUnique: vi.fn(), updateMany: vi.fn() },
		checkout: { create: vi.fn() },
		order: { count: vi.fn(), create: vi.fn() },
		user: { findUnique: vi.fn(), create: vi.fn() },
		address: { findFirst: vi.fn(), create: vi.fn() },
		$transaction: vi.fn()
	};
	db.$transaction.mockImplementation((fn: (tx: typeof db) => unknown) => fn(db));
	return { default: db };
});
vi.mock('../../lib/delivery/estimate.js', () => ({ getDeliveryFee: vi.fn() }));

import prisma from '../../lib/db.js';
import { getDeliveryFee } from '../../lib/delivery/estimate.js';
import { createCheckout, quoteCheckout } from '../checkout.js';

const decimal = (n: number) => ({ toNumber: () => n });
const rice = {
	id: 1,
	caloriesPer100g: decimal(130),
	proteinGPer100g: decimal(2.7),
	carbsGPer100g: decimal(28),
	fatGPer100g: decimal(0.3),
	fiberGPer100g: null,
	pricePerG: decimal(50)
};
const request = {
	address: 'Calle 125 # 18A-05',
	// unit price: 1200 packaging + 200g x 50 + 300 cutlery = 11500
	bowls: [
		{
			bowlSize: 250,
			items: [{ ingredientId: 1, quantityGrams: 200 }],
			includeCutlery: true,
			quantity: 2
		}
	],
	customer: { name: 'Ana', phone: '3001234567' }
};
const coupon = {
	id: 7,
	code: 'HOLA10',
	type: 'percent',
	value: decimal(10),
	active: true,
	startsAt: new Date('2020-01-01T00:00:00Z'),
	endsAt: new Date('2099-01-01T00:00:00Z'),
	budgetRemaining: decimal(100000),
	minBowls: 1,
	firstPurchaseOnly: false
};

async function call(
	handler: typeof createCheckout,
	body: unknown
): Promise<APIGatewayProxyResult & { json: Record<string, unknown> }> {
	const event = { body: JSON.stringify(body), headers: {} } as unknown as APIGatewayProxyEvent;
	const response = (await handler(event, {} as Context, () => {})) as APIGatewayProxyResult;
	return { ...response, json: JSON.parse(response.body) };
}

describe('checkout handlers', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(prisma.storeConfig.findFirst).mockResolvedValue(null);
		vi.mocked(prisma.ingredient.findMany).mockResolvedValue([rice] as never);
		vi.mocked(getDeliveryFee).mockResolvedValue(4000);
	});

	it('quotes subtotal, delivery, discount, service fee and total', async () => {
		vi.mocked(prisma.coupon.findUnique).mockResolvedValue(coupon as never);

		const response = await call(quoteCheckout, { ...request, couponCode: 'hola10' });

		// subtotal 23000, discount 2300, fee 800 + 3% of 24700 = 1541 -> 1500
		expect(response.statusCode).toBe(200);
		expect(response.json).toEqual({
			subtotal: 23000,
			deliveryFee: 4000,
			discount: 2300,
			serviceFee: 1500,
			total: 26200,
			coupon: { code: 'HOLA10', type: 'percent', value: 10 },
			couponRejection: null
		});
	});

	it('quotes a rejected coupon as 200 with the reason', async () => {
		vi.mocked(prisma.coupon.findUnique).mockResolvedValue(null);

		const response = await call(quoteCheckout, { ...request, couponCode: 'NOPE' });

		expect(response.statusCode).toBe(200);
		expect(response.json).toMatchObject({
			discount: 0,
			coupon: null,
			couponRejection: { reason: 'not_found' }
		});
	});

	it('answers 400 address_not_found when delivery cannot be priced', async () => {
		vi.mocked(getDeliveryFee).mockResolvedValue(null);

		const response = await call(quoteCheckout, request);

		expect(response.statusCode).toBe(400);
		expect(response.json.message).toBe('address_not_found');
	});

	it('answers 409 when the coupon is rejected, creating nothing', async () => {
		vi.mocked(prisma.coupon.findUnique).mockResolvedValue({ ...coupon, minBowls: 3 } as never);

		const response = await call(createCheckout, { ...request, couponCode: 'HOLA10' });

		expect(response.statusCode).toBe(409);
		expect(response.json).toEqual({
			error: 'Conflict',
			message: 'coupon_rejected',
			reason: 'min_bowls',
			minBowls: 3
		});
		expect(prisma.$transaction).not.toHaveBeenCalled();
	});

	it('answers 409 budget_exhausted when the reservation loses a race', async () => {
		vi.mocked(prisma.coupon.findUnique).mockResolvedValue(coupon as never);
		vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: 'u1' } as never);
		vi.mocked(prisma.address.findFirst).mockResolvedValue({ id: 'a1' } as never);
		vi.mocked(prisma.coupon.updateMany).mockResolvedValue({ count: 0 });

		const response = await call(createCheckout, { ...request, couponCode: 'HOLA10' });

		expect(response.statusCode).toBe(409);
		expect(response.json).toMatchObject({ reason: 'budget_exhausted' });
		expect(prisma.checkout.create).not.toHaveBeenCalled();
	});

	it('discounts exactly the delivery fee for a free_shipping coupon', async () => {
		vi.mocked(prisma.coupon.findUnique).mockResolvedValue({
			...coupon,
			type: 'free_shipping',
			value: null
		} as never);

		const response = await call(quoteCheckout, { ...request, couponCode: 'HOLA10' });

		expect(response.json).toMatchObject({ deliveryFee: 4000, discount: 4000 });
	});

	it('treats +57 and 10-digit phones as the same user', async () => {
		vi.mocked(prisma.coupon.findUnique).mockResolvedValue({
			...coupon,
			firstPurchaseOnly: true
		} as never);
		vi.mocked(prisma.order.count).mockResolvedValue(1);

		const response = await call(quoteCheckout, {
			...request,
			couponCode: 'HOLA10',
			phone: '+573001234567'
		});

		expect(prisma.order.count).toHaveBeenCalledWith({ where: { user: { phone: '3001234567' } } });
		expect(response.json).toMatchObject({ couponRejection: { reason: 'not_first_purchase' } });
	});

	it('creates the checkout and one pending order per bowl', async () => {
		vi.mocked(prisma.coupon.findUnique).mockResolvedValue(coupon as never);
		vi.mocked(prisma.coupon.updateMany).mockResolvedValue({ count: 1 });
		vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
		vi.mocked(prisma.user.create).mockResolvedValue({ id: 'u1' } as never);
		vi.mocked(prisma.address.findFirst).mockResolvedValue(null);
		vi.mocked(prisma.address.create).mockResolvedValue({
			id: 'a1',
			streetAddress: request.address,
			neighborhood: 'Bogotá',
			city: 'Bogotá',
			department: 'Bogotá D.C.',
			postalCode: null
		} as never);
		vi.mocked(prisma.checkout.create).mockImplementation(
			(args: { data: { total: number } }) =>
				({ id: 'c0ffee00-0000-4000-8000-000000000000', orderNumber: 1000, ...args.data }) as never
		);

		const response = await call(createCheckout, {
			...request,
			couponCode: 'HOLA10',
			customer: { name: 'Ana', phone: '+573001234567' }
		});

		expect(response.statusCode).toBe(201);
		expect(response.json).toEqual({
			checkoutId: 'c0ffee00-0000-4000-8000-000000000000',
			orderNumber: 1000
		});
		// 23000 + delivery 4000 - discount 2300 + fee (800 + 3% of 24700 = 1541 -> 1500) = 26200
		expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { phone: '3001234567' } });
		expect(prisma.coupon.updateMany).toHaveBeenCalledTimes(1);
		expect(prisma.coupon.updateMany).toHaveBeenCalledWith({
			where: { id: 7, budgetRemaining: { gte: 2300 } },
			data: { budgetRemaining: { decrement: 2300 } }
		});
		expect(vi.mocked(prisma.checkout.create).mock.calls[0][0].data).toMatchObject({
			total: 26200,
			couponId: 7,
			paymentStatus: 'not_required'
		});
		expect(prisma.order.create).toHaveBeenCalledTimes(2);
		expect(vi.mocked(prisma.order.create).mock.calls[0][0].data).toMatchObject({
			status: 'pending',
			checkoutId: 'c0ffee00-0000-4000-8000-000000000000',
			totalPrice: 11500,
			includeCutlery: true
		});
	});
});
