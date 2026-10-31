import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, waitFor } from '@testing-library/svelte';
import { locale, waitLocale } from 'svelte-i18n';
import type { CheckoutQuote, Ingredient, BowlSize, PickupPoint } from '$lib/types';
import { goto } from '$app/navigation';

const { getCheckoutQuoteMock, createCheckoutMock } = vi.hoisted(() => ({
	getCheckoutQuoteMock: vi.fn(),
	createCheckoutMock: vi.fn()
}));

vi.mock('$lib/api/client', () => ({
	getCheckoutQuote: getCheckoutQuoteMock,
	createCheckout: createCheckoutMock,
	ApiError: class extends Error {}
}));

import Pickup from '../Pickup.svelte';

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

const point: PickupPoint = {
	id: 7,
	name: 'UNAL',
	location: 'Facultad de Medicina',
	hours: 'Lunes a viernes, 11am – 2pm',
	active: true,
	displayOrder: 1
};

const quote: CheckoutQuote = {
	subtotal: 1800,
	deliveryFee: 0,
	discount: 0,
	serviceFee: 0,
	total: 1800,
	totalBeforeDiscount: 1800,
	coupon: null,
	couponRejection: null,
	pickupDate: '2026-11-02'
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('Pickup', () => {
	beforeEach(async () => {
		getCheckoutQuoteMock.mockReset();
		createCheckoutMock.mockReset();
		vi.mocked(goto).mockReset();
		locale.set('es');
		await waitLocale();
	});

	it('quotes the pickup point on mount and shows the date, free shipping and no fee disclaimer', async () => {
		getCheckoutQuoteMock.mockResolvedValue(quote);
		const { container } = render(Pickup, {
			props: {
				ingredients: [rice],
				bowls: [
					{
						bowlSize: 450 as BowlSize,
						items: new Map([[1, 100]]),
						quantity: 1,
						includeCutlery: false
					}
				],
				point,
				onBack: vi.fn()
			}
		});
		await waitFor(() => expect(container.textContent).toContain('lunes, 2 de noviembre'));
		const req = getCheckoutQuoteMock.mock.calls[0][0];
		expect(req.pickupPointId).toBe(7);
		expect(req.address).toBeUndefined();
		expect(container.textContent).toContain('UNAL');
		expect(container.textContent).toContain('Gratis');
		expect(container.textContent).not.toContain('se calcula según tu zona de entrega');
	});

	it('submits the checkout with pickupPointId and no address', async () => {
		getCheckoutQuoteMock.mockResolvedValue(quote);
		createCheckoutMock.mockResolvedValue({ checkoutId: 'chk-1', orderNumber: 1000 });
		const { container } = render(Pickup, {
			props: {
				ingredients: [rice],
				bowls: [
					{
						bowlSize: 450 as BowlSize,
						items: new Map([[1, 100]]),
						quantity: 1,
						includeCutlery: false
					}
				],
				point,
				onBack: vi.fn()
			}
		});
		await fireEvent.input(container.querySelector('#pickup-name') as HTMLInputElement, {
			target: { value: 'Ana' }
		});
		await fireEvent.input(container.querySelector('#pickup-phone') as HTMLInputElement, {
			target: { value: '3001234567' }
		});
		const cta = () =>
			Array.from(container.querySelectorAll('button')).find((b) =>
				/Confirmar recogida/.test(b.textContent ?? '')
			) as HTMLButtonElement;
		await waitFor(() => expect(cta().disabled).toBe(false));
		expect(cta().textContent).toMatch(/1\.800/);
		await fireEvent.click(cta());

		await waitFor(() => expect(goto).toHaveBeenCalledWith('/order?c=chk-1'));
		const req = createCheckoutMock.mock.calls[0][0];
		expect(req).toMatchObject({
			checkoutId: expect.stringMatching(UUID),
			pickupPointId: 7,
			customer: { name: 'Ana', phone: '3001234567' }
		});
		expect(req.address).toBeUndefined();
	});
});
