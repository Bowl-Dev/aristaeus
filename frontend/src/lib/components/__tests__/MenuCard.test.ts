import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/svelte';
import { locale, waitLocale } from 'svelte-i18n';
import MenuCard from '../MenuCard.svelte';
import type { Menu, MenuIngredientItem } from '$lib/types';
import { bowlBasePrice, roundToNearestCoin, formatCOP } from '$lib/utils/bowl';

const makeItem = (overrides: Partial<MenuIngredientItem> = {}): MenuIngredientItem => ({
	ingredientId: 1,
	ingredientName: 'Rice',
	ingredientNameEs: 'Arroz',
	ingredientNameEn: 'Rice',
	quantityGrams: 100,
	sequenceOrder: 1,
	caloriesPer100g: 130,
	proteinGPer100g: 3,
	carbsGPer100g: 28,
	fatGPer100g: 0,
	fiberGPer100g: 1,
	pricePerG: 5,
	...overrides
});

const menu: Menu = {
	id: 1,
	nameEs: 'Bowl Mediterráneo',
	nameEn: 'Mediterranean Bowl',
	descriptionEs: 'Descripción',
	descriptionEn: 'Description',
	bowlSize: 450,
	active: true,
	displayOrder: 1,
	imageUrl: null,
	ingredients: [
		makeItem({ ingredientId: 1, quantityGrams: 100, pricePerG: 5 }),
		makeItem({ ingredientId: 2, quantityGrams: 50, pricePerG: 12 })
	]
};

const makeProps = (overrides: Record<string, unknown> = {}) => ({
	menu,
	locale: 'es',
	onCustomize: vi.fn(),
	...overrides
});

describe('MenuCard (locale=es)', () => {
	beforeEach(async () => {
		locale.set('es');
		await waitLocale();
	});

	it('renders the total bowl price using the cart pricing formula', () => {
		// Mirrors Cart's unit price (no cutlery): base price + Σ(pricePerG * grams),
		// rounded to the nearest coin.
		const ingredientsPrice = 100 * 5 + 50 * 12; // 1100
		const expected = formatCOP(roundToNearestCoin(bowlBasePrice(450) + ingredientsPrice));

		const { container } = render(MenuCard, { props: makeProps() });
		expect(container.textContent).toContain(expected);
	});

	it('renders the price label', () => {
		const { container } = render(MenuCard, { props: makeProps() });
		expect(container.textContent).toContain('Precio total');
	});
});
