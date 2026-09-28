import { describe, it, expect } from 'vitest';
import type { Ingredient } from '@prisma/client';
import { priceBowl, computeDiscount, computeTotals } from '../pricing.js';

const rice = {
	id: 1,
	caloriesPer100g: { toNumber: () => 130 },
	proteinGPer100g: { toNumber: () => 2.7 },
	carbsGPer100g: { toNumber: () => 28 },
	fatGPer100g: { toNumber: () => 0.3 },
	fiberGPer100g: null,
	pricePerG: { toNumber: () => 50 }
} as unknown as Ingredient;
const ingredients = new Map([[1, rice]]);

describe('pricing', () => {
	it('adds cutlery to the bowl unit price', () => {
		const bowl = { bowlSize: 250 as const, items: [{ ingredientId: 1, quantityGrams: 200 }] };
		// 1200 packaging + 200g x 50
		expect(priceBowl({ ...bowl, includeCutlery: false, quantity: 1 }, ingredients).unitPrice).toBe(
			11200
		);
		expect(priceBowl({ ...bowl, includeCutlery: true, quantity: 1 }, ingredients).unitPrice).toBe(
			11500
		);
	});

	it('computes each coupon type', () => {
		expect(computeDiscount({ type: 'percent', value: 10 }, 23500, 4000)).toBe(2400);
		expect(computeDiscount({ type: 'fixed', value: 5000 }, 23500, 4000)).toBe(5000);
		expect(computeDiscount({ type: 'fixed', value: 50000 }, 23500, 4000)).toBe(23500);
		expect(computeDiscount({ type: 'free_shipping', value: null }, 23500, 4000)).toBe(4000);
	});

	it('charges 800 + 3% service fee on the discounted amount', () => {
		// 800 + 0.03 * (20000 + 4000 - 2000) = 1460 -> 1500
		expect(computeTotals(20000, 4000, 2000)).toEqual({ serviceFee: 1500, total: 23500 });
		expect(computeTotals(0, 0, 0)).toEqual({ serviceFee: 800, total: 800 });
	});
});
