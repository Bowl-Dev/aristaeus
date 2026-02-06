/**
 * Nutrition Calculation Unit Tests
 */

import { describe, it, expect } from 'vitest';
import { calculateNutrition } from '../nutrition.js';

// Mock ingredient data
const mockIngredients = new Map([
	[
		1,
		{
			id: 1,
			name: 'Rice',
			caloriesPer100g: { toNumber: () => 130 },
			proteinGPer100g: { toNumber: () => 2.7 },
			carbsGPer100g: { toNumber: () => 28 },
			fatGPer100g: { toNumber: () => 0.3 },
			fiberGPer100g: { toNumber: () => 0.4 },
			pricePerG: { toNumber: () => 5 }
		}
	],
	[
		2,
		{
			id: 2,
			name: 'Chicken',
			caloriesPer100g: { toNumber: () => 165 },
			proteinGPer100g: { toNumber: () => 31 },
			carbsGPer100g: { toNumber: () => 0 },
			fatGPer100g: { toNumber: () => 3.6 },
			fiberGPer100g: { toNumber: () => 0 },
			pricePerG: { toNumber: () => 15 }
		}
	]
]);

describe('calculateNutrition', () => {
	it('should calculate nutrition for single ingredient', () => {
		const items = [{ ingredientId: 1, quantityGrams: 100 }];

		const result = calculateNutrition(items, mockIngredients as never);

		expect(result.totalCalories).toBe(130);
		expect(result.totalProteinG).toBe(2.7);
		expect(result.totalCarbsG).toBe(28);
		expect(result.totalFatG).toBe(0.3);
		expect(result.totalFiberG).toBe(0.4);
		expect(result.totalWeightG).toBe(100);
		expect(result.totalPrice).toBe(500); // 100g * 5 per g
	});

	it('should calculate nutrition for multiple ingredients', () => {
		const items = [
			{ ingredientId: 1, quantityGrams: 100 },
			{ ingredientId: 2, quantityGrams: 50 }
		];

		const result = calculateNutrition(items, mockIngredients as never);

		// Rice: 130 cal + Chicken: 82.5 cal (165 * 0.5)
		expect(result.totalCalories).toBeCloseTo(212.5, 1);
		// Rice: 2.7g + Chicken: 15.5g (31 * 0.5)
		expect(result.totalProteinG).toBeCloseTo(18.2, 1);
		expect(result.totalWeightG).toBe(150);
		// Rice: 500 + Chicken: 750 = 1250, rounded to nearest 100 COP = 1300
		expect(result.totalPrice).toBe(1300);
	});

	it('should handle fractional quantities correctly', () => {
		const items = [{ ingredientId: 1, quantityGrams: 75 }];

		const result = calculateNutrition(items, mockIngredients as never);

		// 130 * 0.75 = 97.5
		expect(result.totalCalories).toBeCloseTo(97.5, 1);
		expect(result.totalWeightG).toBe(75);
	});

	it('should return zero for empty items', () => {
		const items: { ingredientId: number; quantityGrams: number }[] = [];

		const result = calculateNutrition(items, mockIngredients as never);

		expect(result.totalCalories).toBe(0);
		expect(result.totalWeightG).toBe(0);
		expect(result.totalPrice).toBe(0);
	});

	it('should skip ingredients not found in map', () => {
		const items = [
			{ ingredientId: 1, quantityGrams: 100 },
			{ ingredientId: 999, quantityGrams: 50 } // Non-existent
		];

		const result = calculateNutrition(items, mockIngredients as never);

		// Should only include rice
		expect(result.totalCalories).toBe(130);
		expect(result.totalWeightG).toBe(100);
	});
});
