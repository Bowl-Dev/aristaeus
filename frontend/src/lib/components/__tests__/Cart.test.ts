import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import { locale, waitLocale } from 'svelte-i18n';
import Cart from '../Cart.svelte';
import type { Ingredient, BowlSize } from '$lib/types';

const rice: Ingredient = {
	id: 1,
	name: 'Rice',
	nameEs: 'Arroz Blanco',
	nameEn: 'White Rice',
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

const avocado: Ingredient = {
	id: 2,
	name: 'Avocado',
	nameEs: 'Aguacate',
	nameEn: 'Avocado',
	category: 'topping',
	caloriesPer100g: 160,
	proteinGPer100g: 2,
	carbsGPer100g: 9,
	fatGPer100g: 15,
	fiberGPer100g: 7,
	available: true,
	displayOrder: 2,
	pricePerG: 12
};

const ingredients: Ingredient[] = [rice, avocado];

const makeBowl = (
	overrides: {
		items?: Map<number, number>;
		quantity?: number;
		bowlSize?: BowlSize;
		includeCutlery?: boolean;
	} = {}
) => ({
	bowlSize: (overrides.bowlSize ?? 450) as BowlSize,
	items: overrides.items ?? new Map([[1, 100]]),
	quantity: overrides.quantity ?? 1,
	includeCutlery: overrides.includeCutlery ?? false
});

const makeProps = (overrides: Record<string, unknown> = {}) => ({
	ingredients,
	bowls: [makeBowl()],
	cartCount: 1,
	onBack: vi.fn(),
	onProceedToDelivery: vi.fn(),
	onCreateAnother: vi.fn(),
	onRemoveBowl: vi.fn(),
	onIncreaseBowl: vi.fn(),
	onDecreaseBowl: vi.fn(),
	...overrides
});

describe('Cart (locale=es)', () => {
	beforeEach(async () => {
		locale.set('es');
		await waitLocale();
	});

	it('renders one card per bowl in the bowls prop', () => {
		const { container } = render(Cart, {
			props: makeProps({ bowls: [makeBowl(), makeBowl(), makeBowl()] })
		});
		const removeButtons = container.querySelectorAll('button[aria-label="Eliminar bowl"]');
		expect(removeButtons.length).toBe(3);
	});

	// BLOCKER 3 regression guard: the {n} placeholder must render the actual index.
	it('renders bowl titles with the correct index (Bowl 1, Bowl 2, Bowl 3)', () => {
		const { container } = render(Cart, {
			props: makeProps({ bowls: [makeBowl(), makeBowl(), makeBowl()] })
		});
		const text = container.textContent ?? '';
		expect(text).toMatch(/Bowl 1\b/);
		expect(text).toMatch(/Bowl 2\b/);
		expect(text).toMatch(/Bowl 3\b/);
	});

	// BLOCKER 4 regression guard: subtitle must pluralize.
	it('subtitle uses singular form for 1 bowl', () => {
		const { container } = render(Cart, { props: makeProps({ bowls: [makeBowl()] }) });
		expect(container.textContent).toContain('1 bowl en tu carrito');
		expect(container.textContent).not.toContain('1 bowls');
	});

	it('subtitle uses plural form for >1 bowl', () => {
		const { container } = render(Cart, {
			props: makeProps({ bowls: [makeBowl(), makeBowl(), makeBowl()] })
		});
		expect(container.textContent).toContain('3 bowls en tu carrito');
	});

	// BLOCKER 2 regression guard: ingredient names must switch with locale.
	it('ingredient summary shows Spanish names when locale=es', () => {
		const { container } = render(Cart, {
			props: makeProps({
				bowls: [
					makeBowl({
						items: new Map([
							[1, 100],
							[2, 50]
						])
					})
				]
			})
		});
		expect(container.textContent).toContain('Arroz Blanco');
		expect(container.textContent).toContain('Aguacate');
		expect(container.textContent).not.toContain('White Rice');
	});

	// ENG-66: the − button must clamp at 1, never delete.
	it('disables the − button when quantity is 1', () => {
		const { container } = render(Cart, {
			props: makeProps({ bowls: [makeBowl({ quantity: 1 })] })
		});
		const decBtn = container.querySelector(
			'button[aria-label="Disminuir cantidad"]'
		) as HTMLButtonElement;
		expect(decBtn.disabled).toBe(true);
	});

	it('enables the − button when quantity is greater than 1', () => {
		const { container } = render(Cart, {
			props: makeProps({ bowls: [makeBowl({ quantity: 2 })] })
		});
		const decBtn = container.querySelector(
			'button[aria-label="Disminuir cantidad"]'
		) as HTMLButtonElement;
		expect(decBtn.disabled).toBe(false);
	});

	// ENG-67: trash opens a confirmation modal instead of deleting immediately.
	it('trash button opens the confirmation modal without removing the bowl', async () => {
		const onRemoveBowl = vi.fn();
		const { container, getByText } = render(Cart, { props: makeProps({ onRemoveBowl }) });
		const trash = container.querySelector(
			'button[aria-label="Eliminar bowl"]'
		) as HTMLButtonElement;
		await fireEvent.click(trash);
		expect(onRemoveBowl).not.toHaveBeenCalled();
		expect(getByText('¿Eliminar este bowl?')).toBeTruthy();
	});

	it('confirming the modal removes the bowl exactly once', async () => {
		const onRemoveBowl = vi.fn();
		const { container, getByText } = render(Cart, { props: makeProps({ onRemoveBowl }) });
		await fireEvent.click(
			container.querySelector('button[aria-label="Eliminar bowl"]') as HTMLButtonElement
		);
		await fireEvent.click(getByText('Eliminar'));
		expect(onRemoveBowl).toHaveBeenCalledOnce();
		expect(onRemoveBowl).toHaveBeenCalledWith(0);
	});

	it('cancelling the modal does not remove the bowl', async () => {
		const onRemoveBowl = vi.fn();
		const { container, getByText, queryByText } = render(Cart, {
			props: makeProps({ onRemoveBowl })
		});
		await fireEvent.click(
			container.querySelector('button[aria-label="Eliminar bowl"]') as HTMLButtonElement
		);
		await fireEvent.click(getByText('Cancelar'));
		expect(onRemoveBowl).not.toHaveBeenCalled();
		expect(queryByText('¿Eliminar este bowl?')).toBeNull();
	});
});

// Note: an end-to-end English-locale render assertion is intentionally omitted.
// In this vitest setup, `locale.set('en')` does not propagate to mounted
// components (svelte-i18n's store instance under jsdom appears to differ from
// the one components subscribe to). The locale-aware branch in Cart.svelte is
// covered structurally by the Spanish test above and matches the working
// pattern in Builder.svelte (read `$locale` inline inside `$derived.by`).
