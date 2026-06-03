import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, waitFor } from '@testing-library/svelte';
import { locale, waitLocale } from 'svelte-i18n';
import type { Ingredient, Menu } from '$lib/types';

const { getIngredientsMock, getMenusMock, createOrderMock, FakeApiError } = vi.hoisted(() => {
	class FakeApiError extends Error {
		status: number;
		constructor(status: number, message: string) {
			super(message);
			this.status = status;
			this.name = 'ApiError';
		}
	}
	return {
		getIngredientsMock: vi.fn(),
		getMenusMock: vi.fn(),
		createOrderMock: vi.fn(),
		FakeApiError
	};
});

vi.mock('$lib/api/client', () => ({
	getIngredients: getIngredientsMock,
	getMenus: getMenusMock,
	createOrder: createOrderMock,
	ApiError: FakeApiError
}));

import Page from '../+page.svelte';

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

const sampleMenu: Menu = {
	id: 10,
	nameEs: 'Bowl Clásico',
	nameEn: 'Classic Bowl',
	descriptionEs: 'Un clásico',
	descriptionEn: 'A classic',
	bowlSize: 450,
	imageUrl: null,
	active: true,
	displayOrder: 1,
	ingredients: [
		{
			ingredientId: 1,
			quantityGrams: 100,
			sequenceOrder: 1,
			nameEs: 'Arroz',
			nameEn: 'Rice',
			category: 'base'
		}
	]
} as unknown as Menu;

function findButton(container: HTMLElement, match: RegExp): HTMLButtonElement | undefined {
	return Array.from(container.querySelectorAll('button')).find((b) =>
		match.test(b.textContent ?? '')
	);
}

describe('/ +page (view state machine)', () => {
	beforeEach(async () => {
		getIngredientsMock.mockReset();
		getMenusMock.mockReset();
		createOrderMock.mockReset();
		locale.set('es');
		await waitLocale();
	});

	it('shows an error message when loadIngredients fails', async () => {
		getIngredientsMock.mockRejectedValue(new FakeApiError(500, 'kaboom'));
		getMenusMock.mockResolvedValue([]);
		const { container } = render(Page);
		await waitFor(() => expect(container.textContent).toContain('kaboom'));
	});

	it('starts on the landing view', async () => {
		getIngredientsMock.mockResolvedValue([]);
		getMenusMock.mockResolvedValue([]);
		const { container } = render(Page);
		await waitFor(() => expect(findButton(container, /Ordena ahora/)).toBeTruthy());
	});

	it('opens the landing modal when the CTA is clicked', async () => {
		getIngredientsMock.mockResolvedValue([]);
		getMenusMock.mockResolvedValue([]);
		const { container } = render(Page);
		await waitFor(() => expect(findButton(container, /Ordena ahora/)).toBeTruthy());
		await fireEvent.click(findButton(container, /Ordena ahora/) as HTMLButtonElement);
		await waitFor(() => expect(container.textContent).toContain('Desde cero'));
		expect(container.textContent).toContain('Ideas para empezar');
	});

	it('navigates landing → modal → size when "Desde cero" is clicked', async () => {
		getIngredientsMock.mockResolvedValue([]);
		getMenusMock.mockResolvedValue([]);
		const { container } = render(Page);
		await waitFor(() => expect(findButton(container, /Ordena ahora/)).toBeTruthy());
		await fireEvent.click(findButton(container, /Ordena ahora/) as HTMLButtonElement);
		await waitFor(() => expect(findButton(container, /Desde cero/)).toBeTruthy());
		await fireEvent.click(findButton(container, /Desde cero/) as HTMLButtonElement);
		// Size screen heading
		await waitFor(() => expect(container.textContent).toContain('Tamaños'));
		expect(container.textContent).toContain('Capacidad');
	});

	it('navigates landing → modal → menu when "Ideas para empezar" is clicked', async () => {
		getIngredientsMock.mockResolvedValue([rice]);
		getMenusMock.mockResolvedValue([sampleMenu]);
		const { container } = render(Page);
		await waitFor(() => expect(findButton(container, /Ordena ahora/)).toBeTruthy());
		await fireEvent.click(findButton(container, /Ordena ahora/) as HTMLButtonElement);
		await waitFor(() => expect(findButton(container, /Ideas para empezar/)).toBeTruthy());
		await fireEvent.click(findButton(container, /Ideas para empezar/) as HTMLButtonElement);
		await waitFor(() => expect(container.textContent).toContain('Menú sugerido'));
	});

	it('navigates size → builder when a size card is clicked', async () => {
		getIngredientsMock.mockResolvedValue([rice]);
		getMenusMock.mockResolvedValue([]);
		const { container } = render(Page);
		await waitFor(() => expect(findButton(container, /Ordena ahora/)).toBeTruthy());
		await fireEvent.click(findButton(container, /Ordena ahora/) as HTMLButtonElement);
		await waitFor(() => expect(findButton(container, /Desde cero/)).toBeTruthy());
		await fireEvent.click(findButton(container, /Desde cero/) as HTMLButtonElement);
		await waitFor(() => expect(container.textContent).toContain('Tamaños'));
		// SizeCard renders the size label as a clickable card (button or clickable element)
		const mediumCard = findButton(container, /Mediano/);
		expect(mediumCard).toBeTruthy();
		await fireEvent.click(mediumCard as HTMLButtonElement);
		// Builder screen subtitle
		await waitFor(() =>
			expect(container.textContent).toContain('Selecciona ingredientes y ajusta las cantidades')
		);
	});

	// ENG-63: Builder back must return to the step that opened it, not Landing.
	it('Builder → Back returns to Size when entered from Size (not Landing)', async () => {
		getIngredientsMock.mockResolvedValue([rice]);
		getMenusMock.mockResolvedValue([]);
		const { container } = render(Page);
		await waitFor(() => expect(findButton(container, /Ordena ahora/)).toBeTruthy());
		await fireEvent.click(findButton(container, /Ordena ahora/) as HTMLButtonElement);
		await waitFor(() => expect(findButton(container, /Desde cero/)).toBeTruthy());
		await fireEvent.click(findButton(container, /Desde cero/) as HTMLButtonElement);
		await waitFor(() => expect(container.textContent).toContain('Tamaños'));
		await fireEvent.click(findButton(container, /Mediano/) as HTMLButtonElement);
		await waitFor(() =>
			expect(container.textContent).toContain('Selecciona ingredientes y ajusta las cantidades')
		);
		// Back from Builder → Size, not Landing
		const backBtn = container.querySelector('button[aria-label="Volver"]') as HTMLButtonElement;
		await fireEvent.click(backBtn);
		await waitFor(() => expect(container.textContent).toContain('Tamaños'));
		expect(findButton(container, /Ordena ahora/)).toBeFalsy();
	});

	it('Builder → Back returns to Menu when entered from Menu (not Landing)', async () => {
		getIngredientsMock.mockResolvedValue([rice]);
		getMenusMock.mockResolvedValue([sampleMenu]);
		const { container } = render(Page);
		await waitFor(() => expect(findButton(container, /Ordena ahora/)).toBeTruthy());
		await fireEvent.click(findButton(container, /Ordena ahora/) as HTMLButtonElement);
		await waitFor(() => expect(findButton(container, /Ideas para empezar/)).toBeTruthy());
		await fireEvent.click(findButton(container, /Ideas para empezar/) as HTMLButtonElement);
		await waitFor(() => expect(container.textContent).toContain('Menú sugerido'));
		await fireEvent.click(findButton(container, /Personalizar bowl/) as HTMLButtonElement);
		await waitFor(() =>
			expect(container.textContent).toContain('Selecciona ingredientes y ajusta las cantidades')
		);
		// Back from Builder → Menu, not Landing
		const backBtn = container.querySelector('button[aria-label="Volver"]') as HTMLButtonElement;
		await fireEvent.click(backBtn);
		await waitFor(() => expect(container.textContent).toContain('Menú sugerido'));
		expect(findButton(container, /Ordena ahora/)).toBeFalsy();
	});
});
