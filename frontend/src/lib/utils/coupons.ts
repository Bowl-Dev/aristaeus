import type { CouponRecord } from '$lib/types';

export type CouponStatus = 'live' | 'scheduled' | 'expired' | 'exhausted' | 'inactive';

/** What the admin list shows in the Estado column; first match wins. */
export function couponStatus(coupon: CouponRecord, now = Date.now()): CouponStatus {
	if (!coupon.active) return 'inactive';
	if (now > Date.parse(coupon.endsAt)) return 'expired';
	if (coupon.budgetRemaining <= 0) return 'exhausted';
	if (now < Date.parse(coupon.startsAt)) return 'scheduled';
	return 'live';
}
