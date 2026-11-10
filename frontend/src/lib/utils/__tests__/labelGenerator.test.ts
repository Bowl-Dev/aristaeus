import { describe, it, expect, vi } from 'vitest';
import { buildIngredientList, buildLabelPdf } from '../labelGenerator';
import type { AdminOrder, AdminOrderItem, IngredientCategory } from '$lib/types';

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
		ingredientCategory: ingredientCategory as IngredientCategory,
		quantityGrams,
		sequenceOrder
	};
}

describe('buildIngredientList', () => {
	it('orders ingredients by category: base, protein, vegetable, topping, dressing', () => {
		// Deliberately supplied in robot assembly order, which differs from display order
		const items = [
			item('Salsa', 'dressing', 1),
			item('Pollo', 'protein', 2),
			item('Arroz', 'base', 3),
			item('Ajonjolí', 'topping', 4),
			item('Lechuga', 'vegetable', 5)
		];

		expect(buildIngredientList(items)).toBe(
			'Arroz 100g, Pollo 100g, Lechuga 100g, Ajonjolí 100g y Salsa 100g.'
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

// Records every text call with its left/right extent so we can check page bounds.
const drawn: { text: string; left: number; right: number; y: number }[] = [];
vi.mock('jspdf', async (importOriginal) => {
	const { jsPDF } = await importOriginal<typeof import('jspdf')>();
	// jsPDF assigns `text` on the instance, so wrap it after construction.
	class SpyPDF extends jsPDF {
		constructor(...ctorArgs: ConstructorParameters<typeof jsPDF>) {
			super(...ctorArgs);
			const text = this.text.bind(this);
			this.text = ((
				lines: string | string[],
				x: number,
				y: number,
				options?: { align?: string }
			) => {
				for (const line of ([] as string[]).concat(lines)) {
					const w = this.getTextWidth(line);
					const left = options?.align === 'right' ? x - w : x;
					drawn.push({ text: line, left, right: left + w, y });
				}
				return text(lines, x, y, options as Parameters<typeof text>[3]);
			}) as typeof text;
		}
	}
	return { jsPDF: SpyPDF };
});

function order(id: number, items: AdminOrderItem[], name = 'Juan'): AdminOrder {
	return {
		id,
		user: { name },
		items,
		totalWeightG: 600,
		totalCalories: 936.4,
		totalProteinG: 63.2,
		totalCarbsG: 69.6,
		totalFatG: 44.5,
		totalFiberG: 11.6,
		totalPrice: 25100
	} as AdminOrder;
}

// The longest real-world bowl we expect: 10 ingredients with long menu names.
const longBowl = [
	item('Arroz integral con quinoa', 'base', 1, 120),
	item('Pechuga de pollo a la plancha', 'protein', 2, 120),
	item('Salmón ahumado', 'protein', 3, 60),
	item('Mango tommy en cubos', 'vegetable', 4, 50),
	item('Aguacate hass', 'vegetable', 5, 50),
	item('Pepino encurtido', 'vegetable', 6, 40),
	item('Zanahoria rallada', 'vegetable', 7, 40),
	item('Maní tostado', 'topping', 8, 20),
	item('Cebolla crocante', 'topping', 9, 20),
	item('Salsa Teriyaki', 'dressing', 10, 75)
];

describe('buildLabelPdf', () => {
	it('makes one 60 × 55 mm page per bowl', async () => {
		const doc = await buildLabelPdf([order(1, longBowl), order(2, longBowl.slice(0, 2))]);
		expect(doc.internal.pageSize.getWidth()).toBeCloseTo(60, 1);
		expect(doc.internal.pageSize.getHeight()).toBeCloseTo(55, 1);
		expect(doc.getNumberOfPages()).toBe(2);
	});

	it('keeps a long 10-ingredient bowl and a long name inside the page', async () => {
		drawn.length = 0;
		await buildLabelPdf([order(1, longBowl, 'María Fernanda Rodríguez')]);
		expect(drawn.length).toBeGreaterThan(10);
		for (const t of drawn) {
			expect(t.left, t.text).toBeGreaterThanOrEqual(0);
			expect(t.right, t.text).toBeLessThanOrEqual(60);
			expect(t.y, t.text).toBeGreaterThan(0);
			expect(t.y, t.text).toBeLessThanOrEqual(55);
		}
	});
});
