import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';

vi.mock('../../lib/db.js', () => ({
	default: { coupon: { findMany: vi.fn(), create: vi.fn() } }
}));

import prisma from '../../lib/db.js';
import { listCoupons, createCoupon } from '../coupons.js';

async function call(
	handler: typeof listCoupons,
	headers: Record<string, string>,
	body?: unknown
): Promise<APIGatewayProxyResult> {
	const event = {
		headers,
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
});
