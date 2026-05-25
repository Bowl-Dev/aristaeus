import type { Ingredient, BowlSize } from '$lib/types';
import { BOWL_SIZE_PRICES } from '$lib/types';

export interface BowlTotals {
	weight: number;
	calories: number;
	protein: number;
	carbs: number;
	fat: number;
	ingredientsPrice: number;
}

export function computeBowlTotals(
	items: Map<number, number> | ReadonlyMap<number, number>,
	ingredients: Ingredient[]
): BowlTotals {
	let weight = 0;
	let calories = 0;
	let protein = 0;
	let carbs = 0;
	let fat = 0;
	let ingredientsPrice = 0;

	items.forEach((qty, id) => {
		const ing = ingredients.find((i) => i.id === id);
		if (!ing) return;
		const mult = qty / 100;
		calories += ing.caloriesPer100g * mult;
		protein += ing.proteinGPer100g * mult;
		carbs += ing.carbsGPer100g * mult;
		fat += ing.fatGPer100g * mult;
		weight += qty;
		ingredientsPrice += ing.pricePerG * qty;
	});

	return {
		weight,
		calories: Math.round(calories),
		protein: Math.round(protein),
		carbs: Math.round(carbs),
		fat: Math.round(fat),
		ingredientsPrice
	};
}

export function bowlBasePrice(bowlSize: BowlSize): number {
	switch (bowlSize) {
		case 250:
			return BOWL_SIZE_PRICES[0];
		case 450:
			return BOWL_SIZE_PRICES[1];
		case 600:
			return BOWL_SIZE_PRICES[2];
	}
}

const copFormatter = new Intl.NumberFormat('es-CO', {
	style: 'currency',
	currency: 'COP',
	minimumFractionDigits: 0,
	maximumFractionDigits: 0
});

export function formatCOP(amount: number): string {
	return copFormatter.format(amount);
}
