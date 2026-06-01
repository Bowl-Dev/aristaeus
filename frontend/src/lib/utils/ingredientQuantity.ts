import { DRESSING_STEP_GRAMS } from '$lib/types';

/**
 * Per-category quantity rules for the bowl builder.
 *
 * Dressings are quantized to half-container steps (one tap = half a container,
 * {@link DRESSING_STEP_GRAMS}g); toppings step by 5g; everything else by 10g.
 */
export function getQuantityIncrement(category: string): number {
	if (category === 'dressing') return DRESSING_STEP_GRAMS;
	if (category === 'topping') return 5;
	return 10;
}

export function getInitialQuantity(category: string): number {
	if (category === 'dressing') return DRESSING_STEP_GRAMS;
	if (category === 'topping') return 5;
	return 50;
}

/**
 * Convert a dressing quantity in grams to a container count, snapped to the
 * nearest half container (e.g. 12g → 0.5, 24g → 1, 36g → 1.5).
 */
export function gramsToContainers(grams: number): number {
	return Math.round(grams / DRESSING_STEP_GRAMS) / 2;
}

/**
 * Format a container count as a fraction string: 0.5 → "½", 1 → "1",
 * 1.5 → "1½", 2 → "2".
 */
export function formatContainerValue(count: number): string {
	const whole = Math.floor(count);
	const hasHalf = count - whole >= 0.5;
	if (whole === 0) return '½';
	return hasHalf ? `${whole}½` : `${whole}`;
}
