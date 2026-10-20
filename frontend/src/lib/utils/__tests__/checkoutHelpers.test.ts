import { describe, it, expect } from 'vitest';
import { couponStatus } from '../coupons';
import type { CouponRecord } from '$lib/types';

describe('couponStatus', () => {
	const now = Date.parse('2026-10-15T12:00:00-05:00');
	const base: CouponRecord = {
		id: 1,
		code: 'X',
		campaignName: 'c',
		description: null,
		type: 'percent',
		value: 10,
		startsAt: '2026-10-01T00:00:00-05:00',
		endsAt: '2026-10-31T23:59:59-05:00',
		budgetTotal: 100000,
		budgetRemaining: 50000,
		minBowls: 1,
		firstPurchaseOnly: false,
		active: true,
		createdAt: '2026-09-01T00:00:00Z',
		redemptions: 0
	};

	it('derives each status', () => {
		expect(couponStatus(base, now)).toBe('live');
		expect(couponStatus({ ...base, active: false }, now)).toBe('inactive');
		expect(couponStatus({ ...base, budgetRemaining: 0 }, now)).toBe('exhausted');
		expect(couponStatus({ ...base, startsAt: '2026-10-20T00:00:00-05:00' }, now)).toBe('scheduled');
		expect(couponStatus({ ...base, endsAt: '2026-10-10T23:59:59-05:00' }, now)).toBe('expired');
	});
});
