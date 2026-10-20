import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../db.js', () => {
	const db = {
		coupon: { findUnique: vi.fn() },
		order: { count: vi.fn() }
	};
	return { default: db };
});

import prisma from '../db.js';
import { evaluateCoupon } from '../coupons.js';

const decimal = (n: number) => ({ toNumber: () => n });
const now = new Date('2026-10-01T12:00:00Z');
const coupon = (overrides: Record<string, unknown> = {}) => ({
	id: 7,
	code: 'HOLA10',
	type: 'percent',
	value: decimal(10),
	active: true,
	startsAt: new Date('2026-09-01T00:00:00Z'),
	endsAt: new Date('2026-12-31T00:00:00Z'),
	budgetRemaining: decimal(100000),
	minBowls: 1,
	firstPurchaseOnly: false,
	...overrides
});
const cart = { bowlCount: 2, subtotal: 30000, deliveryFee: 4000 };

function withCoupon(overrides?: Record<string, unknown>) {
	vi.mocked(prisma.coupon.findUnique).mockResolvedValue(coupon(overrides) as never);
}

describe('evaluateCoupon', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(prisma.order.count).mockResolvedValue(0);
	});

	it('applies a valid coupon, looking the code up uppercased', async () => {
		withCoupon();
		const result = await evaluateCoupon(' hola10 ', cart, now);
		expect(prisma.coupon.findUnique).toHaveBeenCalledWith({ where: { code: 'HOLA10' } });
		expect(result).toMatchObject({ ok: true, discount: 3000 });
	});

	it.each([
		['not_found', null],
		['inactive', { active: false }],
		['not_started', { startsAt: new Date('2026-11-01T00:00:00Z') }],
		['expired', { endsAt: new Date('2026-09-30T00:00:00Z') }],
		['budget_exhausted', { budgetRemaining: decimal(2900) }]
	])('rejects %s', async (reason, overrides) => {
		if (overrides === null) vi.mocked(prisma.coupon.findUnique).mockResolvedValue(null);
		else withCoupon(overrides);
		expect(await evaluateCoupon('HOLA10', cart, now)).toEqual({ ok: false, reason });
	});

	it('rejects min_bowls with the minimum', async () => {
		withCoupon({ minBowls: 3 });
		expect(await evaluateCoupon('HOLA10', cart, now)).toEqual({
			ok: false,
			reason: 'min_bowls',
			minBowls: 3
		});
	});

	it('rejects not_first_purchase only when a phone is known', async () => {
		withCoupon({ firstPurchaseOnly: true });
		vi.mocked(prisma.order.count).mockResolvedValue(1);
		expect((await evaluateCoupon('HOLA10', cart, now)).ok).toBe(true);
		expect(await evaluateCoupon('HOLA10', { ...cart, phone: '3001234567' }, now)).toEqual({
			ok: false,
			reason: 'not_first_purchase'
		});
	});

	it('reports the first failing check (inactive before expired)', async () => {
		withCoupon({ active: false, endsAt: new Date('2026-09-30T00:00:00Z') });
		expect(await evaluateCoupon('HOLA10', cart, now)).toEqual({ ok: false, reason: 'inactive' });
	});
});
