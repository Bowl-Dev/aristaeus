/**
 * Checkout pricing. Pure: every amount is an integer COP multiple of 100.
 *
 *   total = subtotal + deliveryFee - discount + serviceFee
 */

import type { Ingredient } from '@prisma/client';
import {
	CUTLERY_PRICE,
	roundToNearestCoin,
	type CheckoutBowl,
	type CouponType
} from '@aristaeus/shared';
import { calculateNutrition, type NutritionalSummary } from './nutrition.js';

/** One bowl's nutrition and its unit price, cutlery included. */
export function priceBowl(
	bowl: CheckoutBowl,
	ingredients: Map<number, Ingredient>
): { nutrition: NutritionalSummary; unitPrice: number } {
	const nutrition = calculateNutrition(bowl.items, ingredients, bowl.bowlSize);
	return {
		nutrition,
		unitPrice: nutrition.totalPrice + (bowl.includeCutlery ? CUTLERY_PRICE : 0)
	};
}

/** What a coupon takes off. Never touches the service fee. */
export function computeDiscount(
	coupon: { type: CouponType; value: number | null },
	subtotal: number,
	deliveryFee: number
): number {
	switch (coupon.type) {
		case 'percent':
			return roundToNearestCoin((subtotal * (coupon.value ?? 0)) / 100);
		case 'fixed':
			// Rounded so a fixed value that is not a multiple of 100 still charges whole coins.
			return roundToNearestCoin(Math.min(coupon.value ?? 0, subtotal));
		case 'free_shipping':
			return deliveryFee;
	}
}

// ponytail: service fee switched off (2026-10-21 hotfix) while there is no payment processor to cover.
// Was roundToNearestCoin(800 + 0.03 * (subtotal + deliveryFee - discount)); restore it with Wompi.
export function computeTotals(subtotal: number, deliveryFee: number, discount: number) {
	const serviceFee = 0;
	return { serviceFee, total: subtotal + deliveryFee - discount + serviceFee };
}
