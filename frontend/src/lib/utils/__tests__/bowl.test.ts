import { describe, it, expect } from 'vitest';
import { computeBowlTotals, bowlBasePrice, formatCOP } from '../bowl';
import type { Ingredient } from '$lib/types';

const rice: Ingredient = {
	id: 1,
	name: 'Rice',
	nameEs: 'Arroz',
	nameEn: 'Rice',
	category: 'base',
	caloriesPer100g: 130,
	proteinGPer100g: 3,
	carbsGPer100g: 28,
	fatGPer100g: 0,
	fiberGPer100g: 1,
	available: true,
	displayOrder: 1,
	pricePerG: 5
};

const chicken: Ingredient = {
	id: 2,
	name: 'Chicken',
	nameEs: 'Pollo',
	nameEn: 'Chicken',
	category: 'protein',
	caloriesPer100g: 200,
	proteinGPer100g: 30,
	carbsGPer100g: 0,
	fatGPer100g: 8,
	fiberGPer100g: 0,
	available: true,
	displayOrder: 1,
	pricePerG: 10
};

describe('computeBowlTotals', () => {
	it('returns zeros for an empty map', () => {
		expect(computeBowlTotals(new Map(), [rice])).toEqual({
			weight: 0,
			calories: 0,
			protein: 0,
			carbs: 0,
			fat: 0,
			ingredientsPrice: 0
		});
	});

	it('sums macros and price across multiple ingredients', () => {
		const items = new Map([
			[1, 100],
			[2, 50]
		]);
		const totals = computeBowlTotals(items, [rice, chicken]);
		// rice 100g: 130 cal, 3 protein, 28 carbs, 0 fat, 500 price
		// chicken 50g: 100 cal, 15 protein, 0 carbs, 4 fat, 500 price
		expect(totals).toEqual({
			weight: 150,
			calories: 230,
			protein: 18,
			carbs: 28,
			fat: 4,
			ingredientsPrice: 1000
		});
	});

	it('rounds macros to the nearest integer', () => {
		// 33g rice → 0.33 mult; protein = 0.99 ≈ 1
		const totals = computeBowlTotals(new Map([[1, 33]]), [rice]);
		expect(totals.protein).toBe(1);
	});

	it('silently skips items whose ingredient is not in the catalog', () => {
		const totals = computeBowlTotals(
			new Map([
				[1, 100],
				[999, 50]
			]),
			[rice]
		);
		expect(totals.weight).toBe(100);
	});
});

describe('bowlBasePrice', () => {
	it('returns 1200 / 1300 / 1400 for 250 / 450 / 600', () => {
		expect(bowlBasePrice(250)).toBe(1200);
		expect(bowlBasePrice(450)).toBe(1300);
		expect(bowlBasePrice(600)).toBe(1400);
	});
});

describe('formatCOP', () => {
	it('formats integer amounts as COP currency in es-CO', () => {
		// Different ICU builds produce slightly different separators; match digits + currency marker.
		expect(formatCOP(1800)).toMatch(/\$\s*1\.800/);
	});

	it('renders 0 without decimals', () => {
		expect(formatCOP(0)).not.toMatch(/,/);
	});
});
