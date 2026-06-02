import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, waitFor } from '@testing-library/svelte';
import { locale, waitLocale } from 'svelte-i18n';

const { createOrderMock, FakeApiError } = vi.hoisted(() => {
	class FakeApiError extends Error {
		status: number;
		constructor(status: number, message: string) {
			super(message);
			this.status = status;
			this.name = 'ApiError';
		}
	}
	return { createOrderMock: vi.fn(), FakeApiError };
});

vi.mock('$lib/api/client', () => ({
	createOrder: createOrderMock,
	ApiError: FakeApiError
}));

import Delivery from '../Delivery.svelte';
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

const ingredients: Ingredient[] = [rice];

const makeBowl = (qty = 1, includeCutlery = false) => ({
	bowlSize: 450 as BowlSize,
	items: new Map([[1, 100]]),
	quantity: qty,
	includeCutlery
});

const makeProps = (overrides: Record<string, unknown> = {}) => ({
	ingredients,
	bowls: [makeBowl()],
	cartCount: 1,
	onBack: vi.fn(),
	onOrderSuccess: vi.fn(),
	...overrides
});

function getCta(container: HTMLElement): HTMLButtonElement {
	return Array.from(container.querySelectorAll('button')).find((b) =>
		(b.textContent ?? '').match(/Confirmar Pedido|Enviando/)
	) as HTMLButtonElement;
}

async function fillRequiredFields(container: HTMLElement) {
	await fireEvent.input(container.querySelector('#delivery-name') as HTMLInputElement, {
		target: { value: 'Juan Pérez' }
	});
	await fireEvent.input(container.querySelector('#delivery-phone') as HTMLInputElement, {
		target: { value: '3001234567' }
	});
	await fireEvent.input(container.querySelector('#delivery-address') as HTMLTextAreaElement, {
		target: { value: 'Cra 7 # 50-10' }
	});
}

describe('Delivery', () => {
	beforeEach(async () => {
		createOrderMock.mockReset();
		locale.set('es');
		await waitLocale();
	});

	it('disables the submit button until name, phone, and address are filled', async () => {
		const { container } = render(Delivery, { props: makeProps() });
		const cta = getCta(container);
		expect(cta.disabled).toBe(true);
		await fillRequiredFields(container);
		expect(cta.disabled).toBe(false);
	});

	it('renders the grand total as (base + ingredients) × quantity for each bowl', () => {
		// 450g bowl base = 1300 COP, + 100g rice * 5 = 500 → unit = 1800
		// × quantity 2 = 3600
		const { container } = render(Delivery, { props: makeProps({ bowls: [makeBowl(2)] }) });
		// Two bowls share one summary row showing "× 2"
		expect(container.textContent).toMatch(/×\s*2/);
		// Grand total ($3.600 in es-CO)
		expect(container.textContent).toMatch(/3\.600/);
	});

	it('sends one createOrder request per (bowl × quantity) and calls onOrderSuccess', async () => {
		createOrderMock.mockResolvedValue({ id: 1 });
		const onOrderSuccess = vi.fn();
		const { container } = render(Delivery, {
			props: makeProps({ bowls: [makeBowl(3)], onOrderSuccess })
		});
		await fillRequiredFields(container);
		await fireEvent.click(getCta(container));
		await waitFor(() => expect(onOrderSuccess).toHaveBeenCalledOnce());
		expect(createOrderMock).toHaveBeenCalledTimes(3);
		// Each request is the same payload shape; spot-check the first
		const payload = createOrderMock.mock.calls[0][0];
		expect(payload.bowlSize).toBe(450);
		expect(payload.customer.name).toBe('Juan Pérez');
		expect(payload.customer.phone).toBe('3001234567');
		expect(payload.customer.address.streetAddress).toBe('Cra 7 # 50-10');
		expect(payload.items).toEqual([{ ingredientId: 1, quantityGrams: 100 }]);
	});

	it('shows the API error message and does not call onOrderSuccess when all requests fail', async () => {
		createOrderMock.mockRejectedValue(new FakeApiError(500, 'Server exploded'));
		const onOrderSuccess = vi.fn();
		const { container } = render(Delivery, { props: makeProps({ onOrderSuccess }) });
		await fillRequiredFields(container);
		await fireEvent.click(getCta(container));
		await waitFor(() => expect(container.textContent).toContain('Server exploded'));
		expect(onOrderSuccess).not.toHaveBeenCalled();
	});

	it('renders a partial-failure message when some requests succeed and some fail', async () => {
		// 2 requests (quantity = 2): first succeeds, second fails
		createOrderMock
			.mockResolvedValueOnce({ id: 1 })
			.mockRejectedValueOnce(new FakeApiError(500, 'Nope'));
		const onOrderSuccess = vi.fn();
		const { container } = render(Delivery, {
			props: makeProps({ bowls: [makeBowl(2)], onOrderSuccess })
		});
		await fillRequiredFields(container);
		await fireEvent.click(getCta(container));
		await waitFor(() => expect(container.textContent).toMatch(/1 de 2/));
		expect(container.textContent).toContain('Nope');
		expect(onOrderSuccess).not.toHaveBeenCalled();
	});
});
