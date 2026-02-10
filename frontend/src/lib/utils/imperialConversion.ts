import type { IngredientCategory } from '$lib/types';

// Approximate grams per cup based on ingredient density
const GRAMS_PER_CUP: Record<IngredientCategory, number> = {
	protein: 240, // Dense proteins (chicken, salmon)
	base: 185, // Rice, quinoa
	vegetable: 150, // Mixed vegetables
	topping: 120, // Cheese, nuts (varies widely)
	dressing: 240 // Liquid-like density
};

const TABLESPOONS_PER_CUP = 16;
const TEASPOONS_PER_TABLESPOON = 3;

export type ImperialUnit = 'cup' | 'cups' | 'tbsp' | 'tsp';

export interface ImperialEstimate {
	quantity: string; // e.g., "1/2", "2", "1 1/4"
	unit: ImperialUnit;
	// For backwards compatibility and tests
	display: string; // e.g., "~1/2 cup" or "~2 tbsp"
}

/**
 * Convert grams to approximate imperial measurement
 * Returns the most natural unit (cups for larger amounts, tbsp/tsp for smaller)
 */
export function gramsToImperial(grams: number, category: IngredientCategory): ImperialEstimate {
	const gramsPerCup = GRAMS_PER_CUP[category];

	// For dressings (typically small amounts), prefer tablespoons
	if (category === 'dressing') {
		return formatAsTablespoons(grams, gramsPerCup);
	}

	const cups = grams / gramsPerCup;

	// If less than 1/8 cup, show tablespoons
	if (cups < 0.125) {
		return formatAsTablespoons(grams, gramsPerCup);
	}

	// Otherwise show cups with common fractions
	return formatAsCups(cups);
}

function formatAsCups(cups: number): ImperialEstimate {
	// Common fractions: 1/4, 1/3, 1/2, 2/3, 3/4, 1, 1 1/4, etc.
	const fractions = [
		{ value: 0.25, display: '1/4' },
		{ value: 0.33, display: '1/3' },
		{ value: 0.5, display: '1/2' },
		{ value: 0.67, display: '2/3' },
		{ value: 0.75, display: '3/4' },
		{ value: 1, display: '1' },
		{ value: 1.25, display: '1 1/4' },
		{ value: 1.5, display: '1 1/2' },
		{ value: 1.75, display: '1 3/4' },
		{ value: 2, display: '2' },
		{ value: 2.5, display: '2 1/2' },
		{ value: 3, display: '3' }
	];

	// Find closest fraction
	let closest = fractions[0];
	for (const frac of fractions) {
		if (Math.abs(frac.value - cups) < Math.abs(closest.value - cups)) {
			closest = frac;
		}
	}

	// Use singular "cup" for values <= 1, plural "cups" for values > 1
	const unit: ImperialUnit = closest.value <= 1 ? 'cup' : 'cups';
	return {
		quantity: closest.display,
		unit,
		display: `~${closest.display} ${unit}`
	};
}

function formatAsTablespoons(grams: number, gramsPerCup: number): ImperialEstimate {
	const gramsPerTbsp = gramsPerCup / TABLESPOONS_PER_CUP;
	const tbsp = grams / gramsPerTbsp;

	if (tbsp < 0.5) {
		// Show teaspoons for very small amounts
		const tsp = tbsp * TEASPOONS_PER_TABLESPOON;
		const rounded = Math.max(1, Math.round(tsp));
		return {
			quantity: String(rounded),
			unit: 'tsp',
			display: `~${rounded} tsp`
		};
	}

	const rounded = Math.round(tbsp);
	return {
		quantity: String(rounded),
		unit: 'tbsp',
		display: `~${rounded} tbsp`
	};
}
