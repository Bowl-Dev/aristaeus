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

		const result = calculateNutrition(items, mockIngredients as never, 250);

		expect(result.totalCalories).toBe(130);
		expect(result.totalProteinG).toBe(2.7);
		expect(result.totalCarbsG).toBe(28);
		expect(result.totalFatG).toBe(0.3);
		expect(result.totalFiberG).toBe(0.4);
		expect(result.totalWeightG).toBe(100);
		// 100g * 5 per g = 500, + 1200 packaging = 1700
		expect(result.totalPrice).toBeCloseTo(1700, 0);
	});

	it('should calculate nutrition for multiple ingredients', () => {
		const items = [
			{ ingredientId: 1, quantityGrams: 100 },
			{ ingredientId: 2, quantityGrams: 50 }
		];

		const result = calculateNutrition(items, mockIngredients as never, 450);

		// Rice: 130 cal + Chicken: 82.5 cal (165 * 0.5)
		expect(result.totalCalories).toBeCloseTo(212.5, 1);
		// Rice: 2.7g + Chicken: 15.5g (31 * 0.5)
		expect(result.totalProteinG).toBeCloseTo(18.2, 1);
		expect(result.totalWeightG).toBe(150);
		// Rice: 500 + Chicken: 750 = 1250 + 1300 packaging = 2550, rounded to nearest 100 COP = 2600
		expect(result.totalPrice).toBe(2600);
	});

	it('should handle fractional quantities correctly', () => {
		const items = [{ ingredientId: 1, quantityGrams: 75 }];

		const result = calculateNutrition(items, mockIngredients as never, 250);

		// 130 * 0.75 = 97.5
		expect(result.totalCalories).toBeCloseTo(97.5, 1);
		expect(result.totalWeightG).toBe(75);
	});

	it('should return packaging price for empty items', () => {
		const items: { ingredientId: number; quantityGrams: number }[] = [];

		const result = calculateNutrition(items, mockIngredients as never, 250);

		expect(result.totalCalories).toBe(0);
		expect(result.totalWeightG).toBe(0);
		// Packaging price for 250g bowl = 1200
		expect(result.totalPrice).toBe(1200);
	});

	it('should skip ingredients not found in map', () => {
		const items = [
			{ ingredientId: 1, quantityGrams: 100 },
			{ ingredientId: 999, quantityGrams: 50 } // Non-existent
		];

		const result = calculateNutrition(items, mockIngredients as never, 250);

		// Should only include rice
		expect(result.totalCalories).toBe(130);
		expect(result.totalWeightG).toBe(100);
	});

	it('should include correct packaging price for each bowl size', () => {
		const items = [{ ingredientId: 1, quantityGrams: 100 }];
		// Ingredient price: 100g * 5 per g = 500 COP

		// Test 250g bowl (1200 COP packaging) = 500 + 1200 = 1700
		const result250 = calculateNutrition(items, mockIngredients as never, 250);
		expect(result250.totalPrice).toBeCloseTo(1700, 0);

		// Test 450g bowl (1300 COP packaging) = 500 + 1300 = 1800
		const result450 = calculateNutrition(items, mockIngredients as never, 450);
		expect(result450.totalPrice).toBeCloseTo(1800, 0);

		// Test 600g bowl (1400 COP packaging) = 500 + 1400 = 1900
		const result600 = calculateNutrition(items, mockIngredients as never, 600);
		expect(result600.totalPrice).toBeCloseTo(1900, 0);
	});
});
