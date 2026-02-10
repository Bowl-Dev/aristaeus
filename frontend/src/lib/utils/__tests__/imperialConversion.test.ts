/**
 * Imperial Conversion Tests
 * Tests for gram-to-imperial unit conversion utility
 */

import { describe, it, expect } from 'vitest';
import { gramsToImperial } from '../imperialConversion';

describe('gramsToImperial', () => {
	describe('protein conversions', () => {
		it('should convert 240g protein to ~1 cup', () => {
			expect(gramsToImperial(240, 'protein').display).toBe('~1 cup');
		});

		it('should convert 120g protein to ~1/2 cup', () => {
			expect(gramsToImperial(120, 'protein').display).toBe('~1/2 cup');
		});

		it('should convert 60g protein to ~1/4 cup', () => {
			expect(gramsToImperial(60, 'protein').display).toBe('~1/4 cup');
		});

		it('should convert 480g protein to ~2 cups', () => {
			expect(gramsToImperial(480, 'protein').display).toBe('~2 cups');
		});
	});

	describe('base (rice/quinoa) conversions', () => {
		it('should convert 185g base to ~1 cup', () => {
			expect(gramsToImperial(185, 'base').display).toBe('~1 cup');
		});

		it('should convert ~92g base to ~1/2 cup', () => {
			const result = gramsToImperial(92, 'base');
			expect(result.display).toBe('~1/2 cup');
		});

		it('should convert ~46g base to ~1/4 cup', () => {
			const result = gramsToImperial(46, 'base');
			expect(result.display).toBe('~1/4 cup');
		});
	});

	describe('vegetable conversions', () => {
		it('should convert 150g vegetables to ~1 cup', () => {
			expect(gramsToImperial(150, 'vegetable').display).toBe('~1 cup');
		});

		it('should convert 75g vegetables to ~1/2 cup', () => {
			expect(gramsToImperial(75, 'vegetable').display).toBe('~1/2 cup');
		});

		it('should convert ~37g vegetables to ~1/4 cup', () => {
			const result = gramsToImperial(37, 'vegetable');
			expect(result.display).toBe('~1/4 cup');
		});
	});

	describe('topping conversions', () => {
		it('should convert 120g toppings to ~1 cup', () => {
			expect(gramsToImperial(120, 'topping').display).toBe('~1 cup');
		});

		it('should convert 60g toppings to ~1/2 cup', () => {
			expect(gramsToImperial(60, 'topping').display).toBe('~1/2 cup');
		});
	});

	describe('dressing conversions (tablespoons)', () => {
		it('should convert 15g dressing to ~1 tbsp', () => {
			expect(gramsToImperial(15, 'dressing').display).toBe('~1 tbsp');
		});

		it('should convert 25g dressing to ~2 tbsp', () => {
			expect(gramsToImperial(25, 'dressing').display).toBe('~2 tbsp');
		});

		it('should convert 50g dressing to ~3 tbsp', () => {
			const result = gramsToImperial(50, 'dressing');
			expect(result.display).toMatch(/~[3-4] tbsp/);
		});

		it('should convert 75g dressing to tablespoons', () => {
			const result = gramsToImperial(75, 'dressing');
			expect(result.display).toMatch(/~[5-6] tbsp/);
		});
	});

	describe('small amounts', () => {
		it('should show tablespoons for very small non-dressing amounts', () => {
			const result = gramsToImperial(15, 'vegetable');
			expect(result.display).toMatch(/tbsp|tsp/);
		});

		it('should show teaspoons for tiny amounts', () => {
			const result = gramsToImperial(5, 'protein');
			expect(result.display).toMatch(/tsp/);
		});
	});

	describe('edge cases', () => {
		it('should handle 0 grams', () => {
			const result = gramsToImperial(0, 'protein');
			expect(result.display).toMatch(/~1 tsp/);
		});

		it('should handle large amounts', () => {
			expect(gramsToImperial(720, 'protein').display).toBe('~3 cups');
		});

		it('should return an object with display property', () => {
			const result = gramsToImperial(100, 'protein');
			expect(result).toHaveProperty('display');
			expect(typeof result.display).toBe('string');
		});

		it('should prefix all results with ~', () => {
			const result = gramsToImperial(100, 'protein');
			expect(result.display.startsWith('~')).toBe(true);
		});
	});
});
