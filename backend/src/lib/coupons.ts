/**
 * Coupon evaluation and budget bookkeeping.
 *
 * Budget is reserved when a checkout is created and credited back when its
 * payment fails. Checkouts nobody pays (no webhook ever arrives) are released
 * lazily, the next time their coupon is evaluated.
 */

import type { Coupon, Prisma } from '@prisma/client';
import type { CouponRejection, CouponType } from '@aristaeus/shared';
import prisma from './db.js';
import { computeDiscount } from './pricing.js';

/** An unpaid checkout older than this stops holding its coupon's budget. */
export const ABANDONED_AFTER_MS = 60 * 60 * 1000;

/** Order statuses that do not count as a purchase for first-purchase coupons. */
const UNPAID_STATUSES = ['awaiting_payment', 'payment_failed'];

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
	let coupon = await prisma.coupon.findUnique({ where: { code: code.trim().toUpperCase() } });
	if (!coupon) return { ok: false, reason: 'not_found' };

	if ((await releaseAbandoned(coupon.id, now)) > 0) {
		coupon = await prisma.coupon.findUniqueOrThrow({ where: { id: coupon.id } });
	}

	if (!coupon.active) return { ok: false, reason: 'inactive' };
	if (now < coupon.startsAt) return { ok: false, reason: 'not_started' };
	if (now > coupon.endsAt) return { ok: false, reason: 'expired' };
	if (cart.bowlCount < coupon.minBowls) {
		return { ok: false, reason: 'min_bowls', minBowls: coupon.minBowls };
	}
	if (coupon.firstPurchaseOnly && cart.phone) {
		const purchases = await prisma.order.count({
			where: { user: { phone: cart.phone }, status: { notIn: UNPAID_STATUSES } }
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

/** Fail this coupon's checkouts left unpaid past {@link ABANDONED_AFTER_MS}. Returns how many. */
export async function releaseAbandoned(couponId: number, now = new Date()): Promise<number> {
	const stale = await prisma.checkout.findMany({
		where: {
			couponId,
			paymentStatus: 'awaiting_payment',
			createdAt: { lt: new Date(now.getTime() - ABANDONED_AFTER_MS) }
		},
		select: { id: true }
	});

	let released = 0;
	for (const { id } of stale) {
		if (await prisma.$transaction((tx) => failCheckout(tx, id))) released++;
	}
	return released;
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

/**
 * awaiting_payment -> payment_failed for the checkout and its orders, crediting
 * the coupon budget back. The conditional update makes it safe to race: only
 * one caller wins, so the budget is credited exactly once. Run inside a transaction.
 */
export async function failCheckout(
	tx: Prisma.TransactionClient,
	checkoutId: string
): Promise<boolean> {
	const { count } = await tx.checkout.updateMany({
		where: { id: checkoutId, paymentStatus: 'awaiting_payment' },
		data: { paymentStatus: 'payment_failed' }
	});
	if (count === 0) return false;

	await tx.order.updateMany({ where: { checkoutId }, data: { status: 'payment_failed' } });

	const { couponId, discount } = await tx.checkout.findUniqueOrThrow({
		where: { id: checkoutId },
		select: { couponId: true, discount: true }
	});
	if (couponId !== null && discount > 0) {
		await tx.coupon.update({
			where: { id: couponId },
			data: { budgetRemaining: { increment: discount } }
		});
	}
	return true;
}
