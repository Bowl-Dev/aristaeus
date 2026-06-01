/**
 * Ingredient Helper Tests
 * Tests for dressing container logic and price formatting
 */

import { describe, it, expect } from 'vitest';
import {
	getQuantityIncrement,
	getInitialQuantity,
	gramsToContainers,
	formatContainerValue
} from '$lib/utils/ingredientQuantity';

const DRESSING_STEP_GRAMS = 12;

function formatPricePerGram(pricePerG: number): string {
	return `$${Math.round(pricePerG)}/g`;
}

describe('Dressing Container Logic', () => {
	describe('getQuantityIncrement', () => {
		it('should return a half-container step (12g) for dressing', () => {
			expect(getQuantityIncrement('dressing')).toBe(DRESSING_STEP_GRAMS);
		});

		it('should return 10 for protein', () => {
			expect(getQuantityIncrement('protein')).toBe(10);
		});

		it('should return 10 for base', () => {
			expect(getQuantityIncrement('base')).toBe(10);
		});

		it('should return 10 for vegetable', () => {
			expect(getQuantityIncrement('vegetable')).toBe(10);
		});

		it('should return 5 for topping', () => {
			expect(getQuantityIncrement('topping')).toBe(5);
		});
	});

	describe('getInitialQuantity', () => {
		it('should start dressings at half a container (12g)', () => {
			expect(getInitialQuantity('dressing')).toBe(DRESSING_STEP_GRAMS);
		});

		it('should return 50 for protein', () => {
			expect(getInitialQuantity('protein')).toBe(50);
		});

		it('should return 50 for base', () => {
			expect(getInitialQuantity('base')).toBe(50);
		});

		it('should return 50 for vegetable', () => {
			expect(getInitialQuantity('vegetable')).toBe(50);
		});

		it('should return 5 for topping', () => {
			expect(getInitialQuantity('topping')).toBe(5);
		});
	});

	describe('gramsToContainers', () => {
		it('should convert a half-container step (12g) to 0.5', () => {
			expect(gramsToContainers(12)).toBe(0.5);
		});

		it('should convert 24g to 1 container', () => {
			expect(gramsToContainers(24)).toBe(1);
		});

		it('should convert 36g to 1.5 containers', () => {
			expect(gramsToContainers(36)).toBe(1.5);
		});

		it('should convert 48g to 2 containers', () => {
			expect(gramsToContainers(48)).toBe(2);
		});

		it('should snap legacy 25g amounts to 1 container', () => {
			expect(gramsToContainers(25)).toBe(1);
		});

		it('should snap legacy 50g amounts to 2 containers', () => {
			expect(gramsToContainers(50)).toBe(2);
		});

		it('should handle 0 grams', () => {
			expect(gramsToContainers(0)).toBe(0);
		});
	});

	describe('formatContainerValue', () => {
		it('should render half a container as ½', () => {
			expect(formatContainerValue(0.5)).toBe('½');
		});

		it('should render a whole container as 1', () => {
			expect(formatContainerValue(1)).toBe('1');
		});

		it('should render one and a half containers as 1½', () => {
			expect(formatContainerValue(1.5)).toBe('1½');
		});

		it('should render two containers as 2', () => {
			expect(formatContainerValue(2)).toBe('2');
		});

		it('should render two and a half containers as 2½', () => {
			expect(formatContainerValue(2.5)).toBe('2½');
		});
	});
});

describe('Price Formatting', () => {
	describe('formatPricePerGram', () => {
		it('should format whole number prices', () => {
			expect(formatPricePerGram(25)).toBe('$25/g');
		});

		it('should round decimal prices down', () => {
			expect(formatPricePerGram(25.2)).toBe('$25/g');
		});

		it('should round decimal prices up', () => {
			expect(formatPricePerGram(25.7)).toBe('$26/g');
		});

		it('should handle small prices', () => {
			expect(formatPricePerGram(1.9)).toBe('$2/g');
		});

		it('should handle prices less than 1', () => {
			expect(formatPricePerGram(0.5)).toBe('$1/g');
		});

		it('should handle large prices', () => {
			expect(formatPricePerGram(100)).toBe('$100/g');
		});

		it('should handle zero price', () => {
			expect(formatPricePerGram(0)).toBe('$0/g');
		});
	});
});

describe('Increment/Decrement Logic', () => {
	// Simulating the add/remove ingredient stepping (step driven by category)
	function addIngredient(
		category: string,
		currentQty: number
	): { newQty: number; increment: number } {
		const increment = getQuantityIncrement(category);
		return { newQty: currentQty + increment, increment };
	}

	function removeIngredient(
		category: string,
		currentQty: number
	): { newQty: number | null; decrement: number } {
		const decrement = getQuantityIncrement(category);
		if (currentQty <= decrement) {
			return { newQty: null, decrement }; // null means item should be removed
		}
		return { newQty: currentQty - decrement, decrement };
	}

	describe('adding ingredients', () => {
		it('should add half a container (12g) for dressing', () => {
			const result = addIngredient('dressing', 12);
			expect(result.newQty).toBe(24);
			expect(result.increment).toBe(12);
		});

		it('should add 10g for protein', () => {
			const result = addIngredient('protein', 100);
			expect(result.newQty).toBe(110);
			expect(result.increment).toBe(10);
		});

		it('should add 10g for base', () => {
			const result = addIngredient('base', 80);
			expect(result.newQty).toBe(90);
			expect(result.increment).toBe(10);
		});
	});

	describe('removing ingredients', () => {
		it('should remove half a container (12g) for dressing', () => {
			const result = removeIngredient('dressing', 24);
			expect(result.newQty).toBe(12);
			expect(result.decrement).toBe(12);
		});

		it('should remove 10g for protein', () => {
			const result = removeIngredient('protein', 100);
			expect(result.newQty).toBe(90);
			expect(result.decrement).toBe(10);
		});

		it('should remove a dressing entirely from its minimum half container (12g)', () => {
			const result = removeIngredient('dressing', 12);
			expect(result.newQty).toBeNull();
		});

		it('should remove ingredient entirely when at minimum for protein (10g)', () => {
			const result = removeIngredient('protein', 10);
			expect(result.newQty).toBeNull();
		});
	});
});
