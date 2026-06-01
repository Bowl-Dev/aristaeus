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
	pricePerG: 5,
	imageUrl: 'https://cdn.example.com/ingredients/cherry-tomatoes.jpg'
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

	it('uses the imageUrl from the ingredient as the image src', () => {
		const { container } = render(IngredientRow, { props: makeProps() });
		const img = container.querySelector('img') as HTMLImageElement;
		expect(img.getAttribute('src')).toBe('https://cdn.example.com/ingredients/cherry-tomatoes.jpg');
	});

	it('falls back to the placeholder image when imageUrl is null', () => {
		const ingredient: Ingredient = { ...baseIngredient, imageUrl: null };
		const { container } = render(IngredientRow, {
			props: makeProps({ ingredient })
		});
		const img = container.querySelector('img') as HTMLImageElement;
		expect(img.getAttribute('src')).toBe('/bowl_placeholder.png');
	});

	it('uses a 5g step for toppings (enabled when 5g remains)', () => {
		const topping: Ingredient = { ...baseIngredient, category: 'topping' };
		const { container } = render(IngredientRow, {
			props: makeProps({ ingredient: topping, remaining: 6 })
		});
		const addBtn = container.querySelector('button') as HTMLButtonElement;
		expect(addBtn.disabled).toBe(false);
	});

	it('quantizes dressings to half-container (12g) steps (Add disabled below a half container)', () => {
		const dressing: Ingredient = { ...baseIngredient, category: 'dressing' };
		const tooLittle = render(IngredientRow, {
			props: makeProps({ ingredient: dressing, remaining: 6 })
		});
		expect((tooLittle.container.querySelector('button') as HTMLButtonElement).disabled).toBe(true);

		const halfContainer = render(IngredientRow, {
			props: makeProps({ ingredient: dressing, remaining: 12 })
		});
		expect((halfContainer.container.querySelector('button') as HTMLButtonElement).disabled).toBe(
			false
		);
	});

	it('labels a half-container dressing as ½ container, not grams', () => {
		const dressing: Ingredient = { ...baseIngredient, category: 'dressing' };
		const { container } = render(IngredientRow, {
			props: makeProps({ ingredient: dressing, quantity: 12 })
		});
		// Tests run in the default 'es' locale → "½ contenedor"
		expect(container.textContent).toContain('½ contenedor');
		expect(container.textContent).not.toContain('12g');
	});

	it('labels a multi-container dressing in containers, not grams', () => {
		const dressing: Ingredient = { ...baseIngredient, category: 'dressing' };
		const { container } = render(IngredientRow, {
			props: makeProps({ ingredient: dressing, quantity: 36 })
		});
		// 36g → 1.5 containers → "1½ contenedores"
		expect(container.textContent).toContain('1½ contenedores');
		expect(container.textContent).not.toContain('36g');
	});

	it('shows per-100g reference values with a /100g label when quantity is 0', () => {
		const ingredient: Ingredient = {
			...baseIngredient,
			caloriesPer100g: 250,
			proteinGPer100g: 20,
			carbsGPer100g: 30,
			fatGPer100g: 10
		};
		const { container } = render(IngredientRow, { props: makeProps({ ingredient, quantity: 0 }) });
		const text = container.textContent ?? '';
		expect(text).toContain('250 cal');
		expect(text).toContain('20g P');
		expect(text).toContain('30g C');
		expect(text).toContain('10g G');
		expect(text).toContain('/100g');
	});

	it('scales chips to the selected quantity and hides the /100g label when added', () => {
		const ingredient: Ingredient = {
			...baseIngredient,
			caloriesPer100g: 250,
			proteinGPer100g: 20,
			carbsGPer100g: 30,
			fatGPer100g: 10
		};
		// 10g of a 250 cal/100g ingredient → 25 cal, 2g P, 3g C, 1g G
		const { container } = render(IngredientRow, {
			props: makeProps({ ingredient, quantity: 10 })
		});
		const text = container.textContent ?? '';
		expect(text).toContain('25 cal');
		expect(text).toContain('2g P');
		expect(text).toContain('3g C');
		expect(text).toContain('1g G');
		expect(text).not.toContain('/100g');
		expect(text).not.toContain('250 cal');
	});

	it('rounds scaled chip values to the nearest integer', () => {
		const ingredient: Ingredient = { ...baseIngredient, caloriesPer100g: 18 };
		// 50g of 18 cal/100g → 9 cal
		const { container } = render(IngredientRow, {
			props: makeProps({ ingredient, quantity: 50 })
		});
		expect(container.textContent ?? '').toContain('9 cal');
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
