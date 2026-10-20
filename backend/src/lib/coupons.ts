/**
 * Coupon evaluation and budget bookkeeping.
 *
 * Budget is taken when a checkout is created; there is no payment step that
 * could fail, so a reservation is final.
 */

import type { Coupon, Prisma } from '@prisma/client';
import type { CouponRejection, CouponType } from '@aristaeus/shared';
import prisma from './db.js';
import { computeDiscount } from './pricing.js';

export type CouponEvaluation =
	| { ok: true; coupon: Coupon; discount: number }
	| { ok: false; reason: CouponRejection; minBowls?: number };

export interface CouponCart {
	bowlCount: number;
	subtotal: number;
	deliveryFee: number;
	/** Unknown in an anonymous quote: the first-purchase rule is then skipped. */
	phone?: string;
}

/** Checks run in a fixed order; the first failure is the reason reported. */
export async function evaluateCoupon(
	code: string,
	cart: CouponCart,
	now = new Date()
): Promise<CouponEvaluation> {
	const coupon = await prisma.coupon.findUnique({ where: { code: code.trim().toUpperCase() } });
	if (!coupon) return { ok: false, reason: 'not_found' };

	if (!coupon.active) return { ok: false, reason: 'inactive' };
	if (now < coupon.startsAt) return { ok: false, reason: 'not_started' };
	if (now > coupon.endsAt) return { ok: false, reason: 'expired' };
	if (cart.bowlCount < coupon.minBowls) {
		return { ok: false, reason: 'min_bowls', minBowls: coupon.minBowls };
	}
	if (coupon.firstPurchaseOnly && cart.phone) {
		const purchases = await prisma.order.count({
			where: { user: { phone: cart.phone } }
		});
		if (purchases > 0) return { ok: false, reason: 'not_first_purchase' };
	}

	const discount = computeDiscount(
		{ type: coupon.type as CouponType, value: coupon.value?.toNumber() ?? null },
		cart.subtotal,
		cart.deliveryFee
	);
	// No partial grants: a discount the budget cannot cover is refused outright.
	if (discount > coupon.budgetRemaining.toNumber())
		return { ok: false, reason: 'budget_exhausted' };

	return { ok: true, coupon, discount };
}

/**
 * Atomically take `discount` from the coupon's budget. False when the budget
 * no longer covers it (someone else got there first).
 */
export async function reserveBudget(
	tx: Prisma.TransactionClient,
	couponId: number,
	discount: number
): Promise<boolean> {
	const { count } = await tx.coupon.updateMany({
		where: { id: couponId, budgetRemaining: { gte: discount } },
		data: { budgetRemaining: { decrement: discount } }
	});
	return count === 1;
}
