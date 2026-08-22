import { describe, it, expect } from 'vitest';
import { buildIngredientList } from '../labelGenerator';
import type { AdminOrderItem } from '$lib/api/client';

function item(
	nameEs: string,
	ingredientCategory: string,
	sequenceOrder: number,
	quantityGrams = 100
): AdminOrderItem {
	return {
		ingredientName: nameEs,
		ingredientNameEs: nameEs,
		ingredientNameEn: nameEs,
		ingredientCategory,
		quantityGrams,
		sequenceOrder
	};
}

describe('buildIngredientList', () => {
	it('orders ingredients by category: base, vegetable, protein, topping, dressing', () => {
		// Deliberately supplied in robot assembly order, which differs from display order
		const items = [
			item('Salsa', 'dressing', 1),
			item('Pollo', 'protein', 2),
			item('Arroz', 'base', 3),
			item('Ajonjolí', 'topping', 4),
			item('Lechuga', 'vegetable', 5)
		];

		expect(buildIngredientList(items)).toBe(
			'Arroz 100g, Lechuga 100g, Pollo 100g, Ajonjolí 100g y Salsa 100g.'
		);
	});

	it('keeps sequenceOrder as the tiebreaker within a category', () => {
		const items = [item('Tomate', 'vegetable', 9), item('Lechuga', 'vegetable', 2)];

		expect(buildIngredientList(items)).toBe('Lechuga 100g y Tomate 100g.');
	});

	it('sorts unknown categories last rather than first', () => {
		const items = [item('Misterio', 'unknown-category', 1), item('Arroz', 'base', 2)];

		expect(buildIngredientList(items)).toBe('Arroz 100g y Misterio 100g.');
	});

	it('formats a single ingredient without a conjunction', () => {
		expect(buildIngredientList([item('Arroz', 'base', 1, 250)])).toBe('Arroz 250g.');
	});

	it('returns an empty string when there are no items', () => {
		expect(buildIngredientList([])).toBe('');
	});
});
