/**
 * Ingredient Helper Tests
 * Tests for dressing container logic and price formatting
 */

import { describe, it, expect } from 'vitest';

const DRESSING_CONTAINER_GRAMS = 25;

// Helper functions to test (extracted from component logic)
function getQuantityIncrement(category: string): number {
	return category === 'dressing' ? DRESSING_CONTAINER_GRAMS : 10;
}

function getInitialQuantity(category: string): number {
	return category === 'dressing' ? DRESSING_CONTAINER_GRAMS : 50;
}

function formatQuantityDisplay(category: string, grams: number): string {
	if (category === 'dressing') {
		const containers = grams / DRESSING_CONTAINER_GRAMS;
		return containers === 1 ? '1 container' : `${containers} containers`;
	}
	return `${grams}g`;
}

function gramsToContainers(grams: number): number {
	return grams / DRESSING_CONTAINER_GRAMS;
}

function formatPricePerGram(pricePerG: number): string {
	return `$${Math.round(pricePerG)}/g`;
}

describe('Dressing Container Logic', () => {
	describe('getQuantityIncrement', () => {
		it('should return 25 for dressing', () => {
			expect(getQuantityIncrement('dressing')).toBe(25);
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

		it('should return 10 for topping', () => {
			expect(getQuantityIncrement('topping')).toBe(10);
		});
	});

	describe('getInitialQuantity', () => {
		it('should return 25 for dressing', () => {
			expect(getInitialQuantity('dressing')).toBe(25);
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

		it('should return 50 for topping', () => {
			expect(getInitialQuantity('topping')).toBe(50);
		});
	});

	describe('formatQuantityDisplay', () => {
		it('should show "1 container" for 25g dressing', () => {
			expect(formatQuantityDisplay('dressing', 25)).toBe('1 container');
		});

		it('should show "2 containers" for 50g dressing', () => {
			expect(formatQuantityDisplay('dressing', 50)).toBe('2 containers');
		});

		it('should show "3 containers" for 75g dressing', () => {
			expect(formatQuantityDisplay('dressing', 75)).toBe('3 containers');
		});

		it('should show "4 containers" for 100g dressing', () => {
			expect(formatQuantityDisplay('dressing', 100)).toBe('4 containers');
		});

		it('should show grams for protein', () => {
			expect(formatQuantityDisplay('protein', 100)).toBe('100g');
		});

		it('should show grams for base', () => {
			expect(formatQuantityDisplay('base', 80)).toBe('80g');
		});

		it('should show grams for vegetable', () => {
			expect(formatQuantityDisplay('vegetable', 60)).toBe('60g');
		});

		it('should show grams for topping', () => {
			expect(formatQuantityDisplay('topping', 30)).toBe('30g');
		});
	});

	describe('gramsToContainers', () => {
		it('should convert 25g to 1 container', () => {
			expect(gramsToContainers(25)).toBe(1);
		});

		it('should convert 50g to 2 containers', () => {
			expect(gramsToContainers(50)).toBe(2);
		});

		it('should convert 75g to 3 containers', () => {
			expect(gramsToContainers(75)).toBe(3);
		});

		it('should convert 100g to 4 containers', () => {
			expect(gramsToContainers(100)).toBe(4);
		});

		it('should handle non-divisible amounts', () => {
			expect(gramsToContainers(30)).toBe(1.2);
		});

		it('should handle 0 grams', () => {
			expect(gramsToContainers(0)).toBe(0);
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
	// Simulating the add/remove ingredient functions
	function addIngredient(
		category: string,
		currentQty: number
	): { newQty: number; increment: number } {
		const increment = category === 'dressing' ? DRESSING_CONTAINER_GRAMS : 10;
		return { newQty: currentQty + increment, increment };
	}

	function removeIngredient(
		category: string,
		currentQty: number
	): { newQty: number | null; decrement: number } {
		const decrement = category === 'dressing' ? DRESSING_CONTAINER_GRAMS : 10;
		if (currentQty <= decrement) {
			return { newQty: null, decrement }; // null means item should be removed
		}
		return { newQty: currentQty - decrement, decrement };
	}

	describe('adding ingredients', () => {
		it('should add 25g for dressing', () => {
			const result = addIngredient('dressing', 25);
			expect(result.newQty).toBe(50);
			expect(result.increment).toBe(25);
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
		it('should remove 25g for dressing', () => {
			const result = removeIngredient('dressing', 50);
			expect(result.newQty).toBe(25);
			expect(result.decrement).toBe(25);
		});

		it('should remove 10g for protein', () => {
			const result = removeIngredient('protein', 100);
			expect(result.newQty).toBe(90);
			expect(result.decrement).toBe(10);
		});

		it('should remove ingredient entirely when at minimum for dressing (25g)', () => {
			const result = removeIngredient('dressing', 25);
			expect(result.newQty).toBeNull();
		});

		it('should remove ingredient entirely when at minimum for protein (10g)', () => {
			const result = removeIngredient('protein', 10);
			expect(result.newQty).toBeNull();
		});

		it('should remove ingredient entirely when below minimum for dressing', () => {
			const result = removeIngredient('dressing', 20);
			expect(result.newQty).toBeNull();
		});
	});
});
