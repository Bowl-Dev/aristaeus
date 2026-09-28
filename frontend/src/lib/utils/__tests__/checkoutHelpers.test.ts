import { describe, it, expect } from 'vitest';
import { wompiCheckoutUrl } from '../wompi';
import { couponStatus } from '../coupons';
import type { CouponRecord } from '$lib/types';

describe('wompiCheckoutUrl', () => {
	it('builds the Web Checkout URL with the encoded integrity signature and redirect', () => {
		const url = wompiCheckoutUrl(
			{
				checkoutId: 'abc',
				orderNumber: 1000,
				reference: 'abc',
				amountInCents: 2500000,
				currency: 'COP',
				signature: 'sig123',
				publicKey: 'pub_test_x'
			},
			'https://algramo.co/order?c=abc'
		);
		expect(url).toBe(
			'https://checkout.wompi.co/p/?public-key=pub_test_x&currency=COP&amount-in-cents=2500000' +
				'&reference=abc&signature%3Aintegrity=sig123' +
				'&redirect-url=https%3A%2F%2Falgramo.co%2Forder%3Fc%3Dabc'
		);
	});
});

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
		createdAt: '2026-09-01T00:00:00Z'
	};

	it('derives each status', () => {
		expect(couponStatus(base, now)).toBe('live');
		expect(couponStatus({ ...base, active: false }, now)).toBe('inactive');
		expect(couponStatus({ ...base, budgetRemaining: 0 }, now)).toBe('exhausted');
		expect(couponStatus({ ...base, startsAt: '2026-10-20T00:00:00-05:00' }, now)).toBe('scheduled');
		expect(couponStatus({ ...base, endsAt: '2026-10-10T23:59:59-05:00' }, now)).toBe('expired');
	});
});
