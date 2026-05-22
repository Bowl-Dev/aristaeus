import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import IngredientRow from '../molecules/IngredientRow.svelte';
import type { Ingredient } from '$lib/types';

const baseIngredient: Ingredient = {
	id: 1,
	name: 'Cherry Tomatoes',
	nameEs: 'Tomates Cherry',
	nameEn: 'Cherry Tomatoes',
	category: 'vegetable',
	caloriesPer100g: 18,
	proteinGPer100g: 1,
	carbsGPer100g: 4,
	fatGPer100g: 0,
	fiberGPer100g: 1,
	available: true,
	displayOrder: 1,
	pricePerG: 5
};

const makeProps = (overrides: Record<string, unknown> = {}) => ({
	ingredient: baseIngredient,
	quantity: 0,
	remaining: 200,
	onAdd: vi.fn(),
	onIncrease: vi.fn(),
	onDecrease: vi.fn(),
	onRemove: vi.fn(),
	...overrides
});

describe('IngredientRow', () => {
	it('renders the Add button only when quantity is 0', () => {
		const { container } = render(IngredientRow, { props: makeProps() });
		const buttons = container.querySelectorAll('button');
		expect(buttons.length).toBe(1);
	});

	it('renders the stepper (− / +) when quantity > 0', () => {
		const { container } = render(IngredientRow, { props: makeProps({ quantity: 50 }) });
		const buttons = container.querySelectorAll('button');
		expect(buttons.length).toBe(2);
	});

	it('disables the Add button when remaining is below the step', () => {
		const { container } = render(IngredientRow, {
			props: makeProps({ remaining: 5 })
		});
		const addBtn = container.querySelector('button') as HTMLButtonElement;
		expect(addBtn.disabled).toBe(true);
	});

	it('uses the slug-derived image src', () => {
		const { container } = render(IngredientRow, { props: makeProps() });
		const img = container.querySelector('img') as HTMLImageElement;
		expect(img.getAttribute('src')).toBe('/ingredients/cherry-tomatoes.jpg');
	});

	it('uses 5g step for dressing/topping and 10g for everything else', () => {
		const dressing: Ingredient = { ...baseIngredient, category: 'dressing' };
		const { container } = render(IngredientRow, {
			props: makeProps({ ingredient: dressing, remaining: 6 })
		});
		const addBtn = container.querySelector('button') as HTMLButtonElement;
		expect(addBtn.disabled).toBe(false);
	});

	it('long-press on the − button triggers onRemove', async () => {
		vi.useFakeTimers();
		const onRemove = vi.fn();
		const { container } = render(IngredientRow, {
			props: makeProps({ quantity: 50, onRemove })
		});
		const decreaseBtn = container.querySelectorAll('button')[0] as HTMLButtonElement;
		await fireEvent.pointerDown(decreaseBtn);
		vi.advanceTimersByTime(600);
		expect(onRemove).toHaveBeenCalledOnce();
		vi.useRealTimers();
	});
});
