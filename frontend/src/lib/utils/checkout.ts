// Shared by the Delivery and Pickup checkout screens.
import {
	type CheckoutBowl,
	type CouponRejection,
	type Ingredient,
	CUTLERY_PRICE,
	roundToNearestCoin
} from '$lib/types';
import { computeBowlTotals, bowlBasePrice } from './bowl';
import type { BowlSnapshot } from './cart';

type Translate = (id: string, options?: { values?: Record<string, string | number> }) => string;

/** Display-only bowl rows; every amount below them comes from the server quote. */
export function summaryLines(bowls: BowlSnapshot[], ingredients: Ingredient[], t: Translate) {
	return bowls.map((b, i) => {
		const size = t(
			b.bowlSize === 250 ? 'size.small' : b.bowlSize === 450 ? 'size.medium' : 'size.large'
		);
		const unit = roundToNearestCoin(
			bowlBasePrice(b.bowlSize) +
				computeBowlTotals(b.items, ingredients).ingredientsPrice +
				(b.includeCutlery ? CUTLERY_PRICE : 0)
		);
		return {
			label: `${t('cart.bowl.title', { values: { n: i + 1, size } })} × ${b.quantity}`,
			amount: unit * b.quantity
		};
	});
}

export function toCheckoutBowls(bowls: BowlSnapshot[]): CheckoutBowl[] {
	return bowls.map((b) => ({
		bowlSize: b.bowlSize,
		items: Array.from(b.items, ([ingredientId, quantityGrams]) => ({
			ingredientId,
			quantityGrams
		})),
		includeCutlery: b.includeCutlery,
		quantity: b.quantity
	}));
}

export function rejectionMessage(
	r: { reason: CouponRejection; minBowls?: number },
	t: Translate
): string {
	return t(`coupon.reason.${r.reason}`, { values: { count: r.minBowls ?? 0 } });
}

/** "lunes, 2 de noviembre" (or short: "lun, 2 nov") for a YYYY-MM-DD day, with no timezone shift. */
export function formatPickupDate(date: string, locale: string, short = false): string {
	const [y, m, d] = date.split('-').map(Number);
	return new Intl.DateTimeFormat(locale, {
		timeZone: 'UTC',
		weekday: short ? 'short' : 'long',
		day: 'numeric',
		month: short ? 'short' : 'long'
	}).format(new Date(Date.UTC(y, m - 1, d)));
}
