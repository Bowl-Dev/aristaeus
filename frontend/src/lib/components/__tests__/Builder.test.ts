import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import { locale, waitLocale } from 'svelte-i18n';
import { SvelteMap } from 'svelte/reactivity';
import Builder from '../Builder.svelte';
import type { Ingredient, BowlSize } from '$lib/types';

const rice: Ingredient = {
	id: 1,
	name: 'Rice',
	nameEs: 'Arroz',
	nameEn: 'Rice',
	category: 'base',
	caloriesPer100g: 130,
	proteinGPer100g: 3,
	carbsGPer100g: 28,
	fatGPer100g: 0,
	fiberGPer100g: 1,
	available: true,
	displayOrder: 1,
	pricePerG: 5
};

const chicken: Ingredient = {
	id: 2,
	name: 'Chicken',
	nameEs: 'Pollo',
	nameEn: 'Chicken',
	category: 'protein',
	caloriesPer100g: 200,
	proteinGPer100g: 30,
	carbsGPer100g: 0,
	fatGPer100g: 8,
	fiberGPer100g: 0,
	available: true,
	displayOrder: 1,
	pricePerG: 10
};

const ingredients: Ingredient[] = [rice, chicken];

const makeProps = (
	overrides: {
		selectedItems?: SvelteMap<number, number>;
		bowlSize?: BowlSize;
		loading?: boolean;
	} = {}
) => ({
	ingredients,
	loading: overrides.loading ?? false,
	bowlSize: (overrides.bowlSize ?? 450) as BowlSize,
	selectedItems: overrides.selectedItems ?? new SvelteMap<number, number>(),
	cartCount: 0,
	onBack: vi.fn(),
	onCart: vi.fn(),
	onAddToCart: vi.fn()
});

describe('Builder', () => {
	beforeEach(async () => {
		locale.set('es');
		await waitLocale();
	});

	it('hides the bottom sheet when no items are selected', () => {
		const { container } = render(Builder, { props: makeProps() });
		expect(container.textContent).not.toContain('Ver detalles');
		expect(container.textContent).not.toContain('Agregar al carrito');
	});

	it('shows the bottom sheet with weight and price when items are selected', () => {
		const items = new SvelteMap<number, number>([[1, 100]]);
		const { container } = render(Builder, { props: makeProps({ selectedItems: items }) });
		// 100g rice in a 450g bowl
		expect(container.textContent).toContain('100g / 450g');
		// price = 5 * 100 = 500 COP
		expect(container.textContent).toMatch(/\$\s*500/);
	});

	it('disables Add to Cart while over capacity and shows the overage warning', () => {
		const items = new SvelteMap<number, number>([
			[1, 300],
			[2, 200]
		]); // 500g in a 450g bowl → 50g over
		const { container } = render(Builder, {
			props: makeProps({ selectedItems: items, bowlSize: 450 })
		});
		expect(container.textContent).toContain('Excede la capacidad por 50g');
		const cta = Array.from(container.querySelectorAll('button')).find((b) =>
			(b.textContent ?? '').includes('Agregar al carrito')
		) as HTMLButtonElement | undefined;
		expect(cta).toBeDefined();
		expect(cta!.disabled).toBe(true);
	});

	it('enables Add to Cart when within capacity and calls onAddToCart on click', async () => {
		const items = new SvelteMap<number, number>([[1, 100]]);
		const onAddToCart = vi.fn();
		const { container } = render(Builder, {
			props: { ...makeProps({ selectedItems: items }), onAddToCart }
		});
		const cta = Array.from(container.querySelectorAll('button')).find((b) =>
			(b.textContent ?? '').includes('Agregar al carrito')
		) as HTMLButtonElement;
		expect(cta.disabled).toBe(false);
		await fireEvent.click(cta);
		expect(onAddToCart).toHaveBeenCalledOnce();
	});

	it('renders the size badge label matching the bowlSize prop', () => {
		const { container, rerender } = render(Builder, { props: makeProps({ bowlSize: 250 }) });
		expect(container.textContent).toContain('Pequeño');
		// Sanity: 600g → Grande
		rerender({ ...makeProps({ bowlSize: 600 }) });
		expect(container.textContent).toContain('Grande');
	});

	it('shows the loading state when loading is true', () => {
		const { container } = render(Builder, { props: makeProps({ loading: true }) });
		expect(container.textContent).toContain('Cargando');
	});

	it('expands the details sheet with macros when "Ver detalles" is clicked', async () => {
		const items = new SvelteMap<number, number>([
			[1, 100],
			[2, 100]
		]);
		const { container } = render(Builder, { props: makeProps({ selectedItems: items }) });
		expect(container.textContent).not.toContain('Macronutrientes');
		const toggle = Array.from(container.querySelectorAll('button')).find((b) =>
			(b.textContent ?? '').includes('Ver detalles')
		) as HTMLButtonElement;
		await fireEvent.click(toggle);
		expect(container.textContent).toContain('Macronutrientes');
		expect(container.textContent).toContain('Ingredientes seleccionados');
		// Selected list shows the Spanish names
		expect(container.textContent).toContain('Arroz');
		expect(container.textContent).toContain('Pollo');
	});
});
