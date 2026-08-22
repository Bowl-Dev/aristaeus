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

const lettuce: Ingredient = {
	id: 3,
	name: 'Lettuce',
	nameEs: 'Lechuga',
	nameEn: 'Lettuce',
	category: 'vegetable',
	caloriesPer100g: 15,
	proteinGPer100g: 1,
	carbsGPer100g: 3,
	fatGPer100g: 0,
	fiberGPer100g: 1,
	available: true,
	displayOrder: 1,
	pricePerG: 3
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
	onAddToCart: vi.fn(),
	onUpsize: vi.fn()
});

// Opens the category accordions (collapsed by default) and returns the add /
// increase control for an ingredient, addressed by its aria-label.
async function openRowsAndFind(container: HTMLElement, label: string) {
	const headers = Array.from(container.querySelectorAll('button[aria-expanded="false"]'));
	for (const header of headers) await fireEvent.click(header);
	return container.querySelector(`button[aria-label="${label}"]`) as HTMLButtonElement;
}

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

	it('shows the weight in the bottom sheet, with the price only in the CTA', () => {
		const items = new SvelteMap<number, number>([[1, 100]]);
		const { container } = render(Builder, { props: makeProps({ selectedItems: items }) });
		// 100g rice in a 450g bowl
		expect(container.textContent).toContain('100g / 450g');
		// price = bowl base (1300) + ingredients (5 * 100 = 500) = 1800 COP
		const priceRe = /\$\s*1[.,]?800/g;
		const cta = Array.from(container.querySelectorAll('button')).find((b) =>
			(b.textContent ?? '').includes('Agregar al carrito')
		) as HTMLButtonElement;
		expect(cta.textContent).toMatch(priceRe);
		// The price appears only in the CTA, never in the sheet (ENG-74)
		expect((container.textContent ?? '').match(priceRe)).toHaveLength(1);
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

	it('renders category accordions as Base → Vegetales → Proteína (ENG-4)', () => {
		// Deliberately out of display order to prove the ordering is applied
		const { container } = render(Builder, {
			props: { ...makeProps(), ingredients: [chicken, lettuce, rice] }
		});
		const headings = Array.from(container.querySelectorAll('button'))
			.map((b) => (b.textContent ?? '').trim())
			.filter((t) => ['Base', 'Vegetales', 'Proteína'].some((c) => t.startsWith(c)));
		expect(headings.map((t) => t.split(/\s+/)[0])).toEqual(['Base', 'Vegetales', 'Proteína']);
	});

	it('shows the loading state when loading is true', () => {
		const { container } = render(Builder, { props: makeProps({ loading: true }) });
		expect(container.textContent).toContain('Cargando');
	});

	describe('full-bowl prompt (ENG-88)', () => {
		// 450g of rice fills a 450g bowl exactly, so any further add is blocked.
		const fullBowl = () => new SvelteMap<number, number>([[1, 450]]);

		it('stays silent on a single blocked attempt', async () => {
			const { container } = render(Builder, {
				props: makeProps({ selectedItems: fullBowl(), bowlSize: 450 })
			});
			const addChicken = await openRowsAndFind(container, 'Agregar Pollo');
			await fireEvent.click(addChicken);
			expect(container.textContent).not.toContain('Tu bowl está lleno');
		});

		it('explains the bowl is full on the second blocked attempt', async () => {
			const { container } = render(Builder, {
				props: makeProps({ selectedItems: fullBowl(), bowlSize: 450 })
			});
			const addChicken = await openRowsAndFind(container, 'Agregar Pollo');
			await fireEvent.click(addChicken);
			await fireEvent.click(addChicken);
			expect(document.body.textContent).toContain('Tu bowl está lleno');
			expect(document.body.textContent).toContain('Agrandar a 600g');
		});

		it('counts blocked attempts across different ingredients', async () => {
			const items = new SvelteMap<number, number>([[1, 450]]);
			const { container } = render(Builder, {
				props: {
					...makeProps({ selectedItems: items, bowlSize: 450 }),
					ingredients: [rice, chicken, lettuce]
				}
			});
			const addChicken = await openRowsAndFind(container, 'Agregar Pollo');
			const addLettuce = container.querySelector(
				'button[aria-label="Agregar Lechuga"]'
			) as HTMLButtonElement;
			await fireEvent.click(addChicken);
			await fireEvent.click(addLettuce);
			expect(document.body.textContent).toContain('Tu bowl está lleno');
		});

		it('upsizes to the next bowl size when the customer accepts', async () => {
			const onUpsize = vi.fn();
			const { container } = render(Builder, {
				props: { ...makeProps({ selectedItems: fullBowl(), bowlSize: 450 }), onUpsize }
			});
			const addChicken = await openRowsAndFind(container, 'Agregar Pollo');
			await fireEvent.click(addChicken);
			await fireEvent.click(addChicken);
			const upsizeBtn = Array.from(document.querySelectorAll('button')).find((b) =>
				(b.textContent ?? '').includes('Agrandar a 600g')
			) as HTMLButtonElement;
			await fireEvent.click(upsizeBtn);
			expect(onUpsize).toHaveBeenCalledWith(600);
			expect(document.body.textContent).not.toContain('Tu bowl está lleno');
		});

		it('offers no upsize at 600g, the largest bowl', async () => {
			const items = new SvelteMap<number, number>([[1, 600]]);
			const { container } = render(Builder, {
				props: makeProps({ selectedItems: items, bowlSize: 600 })
			});
			const addChicken = await openRowsAndFind(container, 'Agregar Pollo');
			await fireEvent.click(addChicken);
			await fireEvent.click(addChicken);
			expect(document.body.textContent).toContain('Tu bowl está lleno');
			expect(document.body.textContent).toContain('el tamaño más grande disponible');
			expect(document.body.textContent).not.toContain('Agrandar a');
		});

		it('resets the streak once capacity is freed', async () => {
			const { container } = render(Builder, {
				props: makeProps({ selectedItems: fullBowl(), bowlSize: 450 })
			});
			const addChicken = await openRowsAndFind(container, 'Agregar Pollo');
			await fireEvent.click(addChicken);

			// Freeing capacity clears the first blocked attempt...
			const decreaseRice = container.querySelector(
				'button[aria-label="Disminuir Arroz"]'
			) as HTMLButtonElement;
			await fireEvent.click(decreaseRice);
			// ...so refilling and tapping once more must not prompt.
			const increaseRice = container.querySelector(
				'button[aria-label="Aumentar Arroz"]'
			) as HTMLButtonElement;
			await fireEvent.click(increaseRice);
			await fireEvent.click(addChicken);
			expect(document.body.textContent).not.toContain('Tu bowl está lleno');
		});
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
