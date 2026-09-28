import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../db.js', () => {
	const db = {
		coupon: { findUnique: vi.fn(), findUniqueOrThrow: vi.fn(), update: vi.fn() },
		checkout: { findMany: vi.fn(), updateMany: vi.fn(), findUniqueOrThrow: vi.fn() },
		order: { count: vi.fn(), updateMany: vi.fn() },
		$transaction: vi.fn()
	};
	db.$transaction.mockImplementation((fn: (tx: typeof db) => unknown) => fn(db));
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
		vi.mocked(prisma.checkout.findMany).mockResolvedValue([]);
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

	it('releases abandoned checkouts before judging the budget', async () => {
		withCoupon({ budgetRemaining: decimal(0) });
		vi.mocked(prisma.checkout.findMany).mockResolvedValue([{ id: 'c1' }] as never);
		vi.mocked(prisma.checkout.updateMany).mockResolvedValue({ count: 1 });
		vi.mocked(prisma.checkout.findUniqueOrThrow).mockResolvedValue({
			couponId: 7,
			discount: 3000
		} as never);
		vi.mocked(prisma.coupon.findUniqueOrThrow).mockResolvedValue(
			coupon({ budgetRemaining: decimal(3000) }) as never
		);

		const result = await evaluateCoupon('HOLA10', cart, now);

		expect(prisma.checkout.findMany).toHaveBeenCalledWith(
			expect.objectContaining({
				where: expect.objectContaining({
					paymentStatus: 'awaiting_payment',
					createdAt: { lt: new Date('2026-10-01T11:00:00Z') }
				})
			})
		);
		expect(prisma.order.updateMany).toHaveBeenCalledWith({
			where: { checkoutId: 'c1' },
			data: { status: 'payment_failed' }
		});
		expect(prisma.coupon.update).toHaveBeenCalledWith({
			where: { id: 7 },
			data: { budgetRemaining: { increment: 3000 } }
		});
		expect(result).toMatchObject({ ok: true, discount: 3000 });
	});
});
