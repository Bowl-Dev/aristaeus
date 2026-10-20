import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';

vi.mock('../../lib/db.js', () => ({
	default: {
		coupon: {
			findMany: vi.fn(),
			create: vi.fn(),
			findUnique: vi.fn(),
			findUniqueOrThrow: vi.fn(),
			updateMany: vi.fn(),
			delete: vi.fn()
		}
	}
}));

import prisma from '../../lib/db.js';
import { listCoupons, createCoupon, updateCoupon, deleteCoupon } from '../coupons.js';

async function call(
	handler: typeof listCoupons,
	headers: Record<string, string>,
	body?: unknown,
	id?: string
): Promise<APIGatewayProxyResult> {
	const event = {
		headers,
		pathParameters: id === undefined ? null : { id },
		body: body === undefined ? null : JSON.stringify(body)
	} as unknown as APIGatewayProxyEvent;
	return (await handler(event, {} as Context, () => {})) as APIGatewayProxyResult;
}

const validCoupon = {
	code: 'hola10',
	campaignName: 'Lanzamiento',
	type: 'percent',
	value: 10,
	startsAt: '2026-10-01T00:00:00-05:00',
	endsAt: '2026-10-31T23:59:59-05:00',
	budgetTotal: 500000,
	minBowls: 1,
	firstPurchaseOnly: true,
	active: true
};

describe('coupon admin handlers', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		process.env.ADMIN_TOKEN = 'secret-token';
		vi.mocked(prisma.coupon.findMany).mockResolvedValue([]);
	});

	it('requires the admin token', async () => {
		expect((await call(listCoupons, {})).statusCode).toBe(401);
		expect((await call(listCoupons, { 'x-admin-token': 'wrong' })).statusCode).toBe(401);
		expect((await call(listCoupons, { 'X-Admin-Token': 'secret-token' })).statusCode).toBe(200);
	});

	it('refuses every request when ADMIN_TOKEN is unset', async () => {
		delete process.env.ADMIN_TOKEN;
		expect((await call(listCoupons, { 'x-admin-token': '' })).statusCode).toBe(401);
	});

	it('validates value per coupon type and the date range', async () => {
		const auth = { 'x-admin-token': 'secret-token' };
		const invalid = [
			{ ...validCoupon, value: 101 },
			{ ...validCoupon, type: 'fixed', value: 12.5 },
			{ ...validCoupon, type: 'free_shipping', value: 5 },
			{ ...validCoupon, endsAt: validCoupon.startsAt },
			{ ...validCoupon, code: 'no spaces' }
		];
		for (const body of invalid) {
			expect((await call(createCoupon, auth, body)).statusCode).toBe(400);
		}
		expect(prisma.coupon.create).not.toHaveBeenCalled();
	});

	describe('update and delete', () => {
		const auth = { 'x-admin-token': 'secret-token' };
		const decimal = (n: number) => ({ toNumber: () => n });
		const stored = (redemptions: number, overrides: Record<string, unknown> = {}) => ({
			id: 7,
			code: 'HOLA10',
			campaignName: 'Lanzamiento',
			description: null,
			type: 'percent',
			value: decimal(10),
			startsAt: new Date('2026-10-01T05:00:00Z'),
			endsAt: new Date('2026-11-01T04:59:59Z'),
			budgetTotal: decimal(500000),
			budgetRemaining: decimal(100000),
			minBowls: 1,
			firstPurchaseOnly: true,
			active: true,
			createdAt: new Date('2026-09-30T00:00:00Z'),
			_count: { checkouts: redemptions },
			...overrides
		});
		const withStored = (redemptions: number) => {
			vi.mocked(prisma.coupon.findUnique).mockResolvedValue(stored(redemptions) as never);
			vi.mocked(prisma.coupon.findUniqueOrThrow).mockResolvedValue(stored(redemptions) as never);
			vi.mocked(prisma.coupon.updateMany).mockResolvedValue({ count: 1 });
		};

		it('keeps an { active } toggle working', async () => {
			withStored(3);
			const response = await call(updateCoupon, auth, { active: false }, '7');
			expect(response.statusCode).toBe(200);
			expect(JSON.parse(response.body)).toMatchObject({ id: 7, redemptions: 3 });
			expect(vi.mocked(prisma.coupon.updateMany).mock.calls[0][0].data).toMatchObject({
				active: false,
				code: 'HOLA10',
				budgetRemaining: { increment: 0 }
			});
		});

		it.each([{ code: 'OTRO10' }, { type: 'fixed', value: 5000 }, { value: 20 }])(
			'locks %o once redeemed',
			async (patch) => {
				withStored(1);
				const response = await call(updateCoupon, auth, patch, '7');
				expect(response.statusCode).toBe(409);
				expect(JSON.parse(response.body).message).toBe('coupon_in_use');
				expect(prisma.coupon.updateMany).not.toHaveBeenCalled();
			}
		);

		it('allows code/type/value changes before any redemption', async () => {
			withStored(0);
			const response = await call(updateCoupon, auth, { code: 'otro10', value: 20 }, '7');
			expect(response.statusCode).toBe(200);
			expect(vi.mocked(prisma.coupon.updateMany).mock.calls[0][0].data).toMatchObject({
				code: 'OTRO10',
				value: 20
			});
		});

		it('validates the merged coupon (endsAt before the stored startsAt)', async () => {
			withStored(0);
			const response = await call(updateCoupon, auth, { endsAt: '2026-09-01T00:00:00Z' }, '7');
			expect(response.statusCode).toBe(400);
		});

		it('shifts budgetRemaining by the budgetTotal delta, guarded at zero', async () => {
			withStored(1);
			await call(updateCoupon, auth, { budgetTotal: 450000 }, '7');
			expect(prisma.coupon.updateMany).toHaveBeenCalledWith(
				expect.objectContaining({
					where: { id: 7, budgetRemaining: { gte: 50000 } },
					data: expect.objectContaining({
						budgetTotal: 450000,
						budgetRemaining: { increment: -50000 }
					})
				})
			);
		});

		it('rejects a budget cut below what was already granted', async () => {
			withStored(1);
			vi.mocked(prisma.coupon.updateMany).mockResolvedValue({ count: 0 });
			const response = await call(updateCoupon, auth, { budgetTotal: 300000 }, '7');
			expect(response.statusCode).toBe(400);
			expect(JSON.parse(response.body).message).toBe('budget_below_redeemed');
		});

		it('deletes an unused coupon and refuses a redeemed one', async () => {
			withStored(0);
			const unused = await call(deleteCoupon, auth, undefined, '7');
			expect(unused.statusCode).toBe(200);
			expect(prisma.coupon.delete).toHaveBeenCalledWith({ where: { id: 7 } });

			vi.clearAllMocks();
			withStored(2);
			const used = await call(deleteCoupon, auth, undefined, '7');
			expect(used.statusCode).toBe(409);
			expect(JSON.parse(used.body).message).toBe('coupon_in_use');
			expect(prisma.coupon.delete).not.toHaveBeenCalled();
		});

		it('answers 404 for a missing coupon', async () => {
			vi.mocked(prisma.coupon.findUnique).mockResolvedValue(null);
			expect((await call(deleteCoupon, auth, undefined, '9')).statusCode).toBe(404);
			expect((await call(updateCoupon, auth, { active: true }, '9')).statusCode).toBe(404);
		});
	});
});
