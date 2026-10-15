import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, waitFor } from '@testing-library/svelte';
import { locale, waitLocale } from 'svelte-i18n';
import type { CheckoutQuote } from '$lib/types';
import { goto } from '$app/navigation';

const { getCheckoutQuoteMock, createCheckoutMock, FakeApiError } = vi.hoisted(() => {
	class FakeApiError extends Error {
		status: number;
		details?: unknown;
		constructor(status: number, message: string, details?: unknown) {
			super(message);
			this.status = status;
			this.details = details;
			this.name = 'ApiError';
		}
	}
	return { getCheckoutQuoteMock: vi.fn(), createCheckoutMock: vi.fn(), FakeApiError };
});

vi.mock('$lib/api/client', () => ({
	getCheckoutQuote: getCheckoutQuoteMock,
	createCheckout: createCheckoutMock,
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

const makeBowl = (qty = 1, includeCutlery = false) => ({
	bowlSize: 450 as BowlSize,
	items: new Map([[1, 100]]),
	quantity: qty,
	includeCutlery
});

const makeProps = (overrides: Record<string, unknown> = {}) => ({
	ingredients: [rice],
	bowls: [makeBowl()],
	cartCount: 1,
	onBack: vi.fn(),
	...overrides
});

// subtotal 1800 + delivery 5000 + service 1000 = 7800
const baseQuote: CheckoutQuote = {
	subtotal: 1800,
	deliveryFee: 5000,
	discount: 0,
	serviceFee: 1000,
	total: 7800,
	totalBeforeDiscount: 7800,
	coupon: null,
	couponRejection: null
};

const checkoutResponse = { checkoutId: 'chk-1', orderNumber: 1000 };

function getCta(container: HTMLElement): HTMLButtonElement {
	return Array.from(container.querySelectorAll('button')).find((b) =>
		(b.textContent ?? '').match(/Hacer pedido|Enviando/)
	) as HTMLButtonElement;
}

function getApply(container: HTMLElement): HTMLButtonElement {
	return Array.from(container.querySelectorAll('button')).find((b) =>
		(b.textContent ?? '').match(/Aplicar/)
	) as HTMLButtonElement;
}

const $ = (container: HTMLElement, sel: string) => container.querySelector(sel) as HTMLInputElement;

async function fillAddress(container: HTMLElement, value = 'Cra 7 # 50-10') {
	const address = $(container, '#delivery-address');
	await fireEvent.input(address, { target: { value } });
	await fireEvent.blur(address);
}

async function fillAll(container: HTMLElement) {
	await fireEvent.input($(container, '#delivery-name'), { target: { value: 'Juan Pérez' } });
	await fireEvent.input($(container, '#delivery-phone'), { target: { value: '3001234567' } });
	await fillAddress(container);
}

async function typeCoupon(container: HTMLElement, value: string) {
	await fireEvent.input($(container, '#delivery-coupon'), { target: { value } });
}

describe('Delivery', () => {
	const gotoMock = vi.mocked(goto);

	beforeEach(async () => {
		getCheckoutQuoteMock.mockReset();
		createCheckoutMock.mockReset();
		gotoMock.mockReset();
		locale.set('es');
		await waitLocale();
	});

	it('shows the client subtotal and an address hint, with the CTA disabled, before a quote', () => {
		const { container } = render(Delivery, { props: makeProps({ bowls: [makeBowl(2)] }) });
		// 450g base 1300 + 100g rice × 5 = 1800 per bowl, × 2
		expect(container.textContent).toMatch(/×\s*2/);
		expect(container.textContent).toMatch(/3\.600/);
		expect(container.textContent).toContain('Ingresa tu dirección');
		expect(getCta(container).disabled).toBe(true);
		expect(getCheckoutQuoteMock).not.toHaveBeenCalled();
	});

	it('quotes when the address loses focus and shows the server amounts', async () => {
		getCheckoutQuoteMock.mockResolvedValue(baseQuote);
		const { container } = render(Delivery, { props: makeProps() });
		await fillAll(container);
		await waitFor(() => expect(getCta(container).disabled).toBe(false));
		expect(getCheckoutQuoteMock).toHaveBeenCalledWith({
			address: 'Cra 7 # 50-10',
			bowls: [
				{
					bowlSize: 450,
					items: [{ ingredientId: 1, quantityGrams: 100 }],
					includeCutlery: false,
					quantity: 1
				}
			],
			couponCode: undefined,
			phone: '3001234567'
		});
		expect(container.textContent).toMatch(/5\.000/);
		expect(getCta(container).textContent).toMatch(/Hacer pedido – \$\s*7\.800/);
	});

	it('does not quote on blur of an empty address', async () => {
		const { container } = render(Delivery, { props: makeProps() });
		await fireEvent.blur($(container, '#delivery-address'));
		expect(getCheckoutQuoteMock).not.toHaveBeenCalled();
	});

	it('shows address_not_found on the address field', async () => {
		getCheckoutQuoteMock.mockRejectedValue(new FakeApiError(400, 'address_not_found'));
		const { container } = render(Delivery, { props: makeProps() });
		await fillAll(container);
		await waitFor(() => expect(container.querySelector('#delivery-address-error')).toBeTruthy());
		expect(container.textContent).toContain('No pudimos ubicar esta dirección');
		expect(getCta(container).disabled).toBe(true);
	});

	it('ignores an older quote that resolves after a newer one', async () => {
		let resolveFirst: (q: CheckoutQuote) => void = () => {};
		getCheckoutQuoteMock
			.mockImplementationOnce(() => new Promise((r) => (resolveFirst = r)))
			.mockResolvedValueOnce({ ...baseQuote, deliveryFee: 9000, total: 11800 });
		const { container } = render(Delivery, { props: makeProps() });
		await fillAll(container);
		await fillAddress(container, 'Calle 100 # 15-20');
		await waitFor(() => expect(container.textContent).toMatch(/11\.800/));
		resolveFirst(baseQuote);
		await new Promise((r) => setTimeout(r, 0));
		expect(container.textContent).toMatch(/11\.800/);
		expect(container.textContent).not.toMatch(/7\.800/);
	});

	it('applies a coupon: success line, discount row and struck-through total', async () => {
		getCheckoutQuoteMock.mockResolvedValueOnce(baseQuote).mockResolvedValueOnce({
			...baseQuote,
			discount: 200,
			total: 7600,
			coupon: { code: 'ALGRAMO10', type: 'percent', value: 10 }
		});
		const { container } = render(Delivery, { props: makeProps() });
		await fillAll(container);
		await typeCoupon(container, 'algramo10');
		expect($(container, '#delivery-coupon').value).toBe('ALGRAMO10');
		await fireEvent.click(getApply(container));
		await waitFor(() =>
			expect(container.textContent).toContain('¡Cupón aplicado! 10% de descuento')
		);
		expect(getCheckoutQuoteMock.mock.calls[1][0].couponCode).toBe('ALGRAMO10');
		const row = container.querySelector('[data-testid="coupon-row"]');
		expect(row?.textContent).toContain('Descuento 10%');
		expect(container.querySelector('[data-testid="pre-discount-total"]')?.textContent).toMatch(
			/7\.800/
		);
		expect(getCta(container).textContent).toMatch(/7\.600/);
	});

	it('re-checks an applied coupon when the phone changes (first-purchase rule)', async () => {
		getCheckoutQuoteMock.mockResolvedValueOnce(baseQuote).mockResolvedValue({
			...baseQuote,
			discount: 200,
			total: 7600,
			coupon: { code: 'ALGRAMO10', type: 'percent', value: 10 }
		});
		const { container } = render(Delivery, { props: makeProps() });
		await fillAll(container);
		await typeCoupon(container, 'ALGRAMO10');
		await fireEvent.click(getApply(container));
		await waitFor(() => expect(container.textContent).toContain('¡Cupón aplicado!'));
		const phone = $(container, '#delivery-phone');
		await fireEvent.input(phone, { target: { value: '3109876543' } });
		await fireEvent.blur(phone);
		await waitFor(() => expect(getCheckoutQuoteMock).toHaveBeenCalledTimes(3));
		expect(getCheckoutQuoteMock.mock.calls[2][0]).toMatchObject({
			couponCode: 'ALGRAMO10',
			phone: '3109876543'
		});
	});

	it('editing an applied coupon removes it and re-quotes without it', async () => {
		getCheckoutQuoteMock
			.mockResolvedValueOnce(baseQuote)
			.mockResolvedValueOnce({
				...baseQuote,
				discount: 200,
				total: 7600,
				coupon: { code: 'ALGRAMO10', type: 'percent', value: 10 }
			})
			.mockResolvedValueOnce(baseQuote);
		const { container } = render(Delivery, { props: makeProps() });
		await fillAll(container);
		await typeCoupon(container, 'ALGRAMO10');
		await fireEvent.click(getApply(container));
		await waitFor(() => expect(container.textContent).toContain('¡Cupón aplicado!'));
		await typeCoupon(container, 'ALGRAMO1');
		await waitFor(() => expect(getCheckoutQuoteMock).toHaveBeenCalledTimes(3));
		expect(getCheckoutQuoteMock.mock.calls[2][0].couponCode).toBeUndefined();
		await waitFor(() => expect(container.textContent).not.toContain('¡Cupón aplicado!'));
	});

	it('shows the rejection reason with the minimum bowl count', async () => {
		getCheckoutQuoteMock.mockResolvedValueOnce(baseQuote).mockResolvedValueOnce({
			...baseQuote,
			couponRejection: { reason: 'min_bowls', minBowls: 2 }
		});
		const { container } = render(Delivery, { props: makeProps() });
		await fillAll(container);
		await typeCoupon(container, 'DOSXUNO');
		await fireEvent.click(getApply(container));
		await waitFor(() =>
			expect(container.textContent).toContain(
				'Debes comprar mínimo 2 bowls para utilizar este cupón'
			)
		);
	});

	it('never reveals that a coupon budget ran out', async () => {
		getCheckoutQuoteMock
			.mockResolvedValueOnce(baseQuote)
			.mockResolvedValueOnce({ ...baseQuote, couponRejection: { reason: 'budget_exhausted' } });
		const { container } = render(Delivery, { props: makeProps() });
		await fillAll(container);
		await typeCoupon(container, 'GONE');
		await fireEvent.click(getApply(container));
		await waitFor(() =>
			expect(container.textContent).toContain('Este cupón ya no se encuentra disponible')
		);
	});

	it('creates the checkout and goes to the order page', async () => {
		getCheckoutQuoteMock.mockResolvedValue(baseQuote);
		createCheckoutMock.mockResolvedValue(checkoutResponse);
		const { container } = render(Delivery, { props: makeProps({ bowls: [makeBowl(3)] }) });
		await fillAll(container);
		await fireEvent.input($(container, '#delivery-instructions'), {
			target: { value: 'Portería' }
		});
		await waitFor(() => expect(getCta(container).disabled).toBe(false));
		await fireEvent.click(getCta(container));
		await waitFor(() => expect(gotoMock).toHaveBeenCalledWith('/order?c=chk-1'));
		expect(createCheckoutMock).toHaveBeenCalledWith(
			expect.objectContaining({
				address: 'Cra 7 # 50-10',
				customer: { name: 'Juan Pérez', phone: '3001234567' },
				phone: '3001234567',
				deliveryInstructions: 'Portería',
				couponCode: undefined
			})
		);
		expect(createCheckoutMock.mock.calls[0][0].bowls[0].quantity).toBe(3);
	});

	it('on 409 coupon_rejected shows the reason, drops the coupon and re-quotes', async () => {
		getCheckoutQuoteMock
			.mockResolvedValueOnce(baseQuote)
			.mockResolvedValueOnce({
				...baseQuote,
				discount: 200,
				total: 7600,
				coupon: { code: 'ALGRAMO10', type: 'percent', value: 10 }
			})
			.mockResolvedValueOnce(baseQuote);
		createCheckoutMock.mockRejectedValue(
			new FakeApiError(409, 'coupon_rejected', {
				message: 'coupon_rejected',
				reason: 'expired'
			})
		);
		const { container } = render(Delivery, { props: makeProps() });
		await fillAll(container);
		await typeCoupon(container, 'ALGRAMO10');
		await fireEvent.click(getApply(container));
		await waitFor(() => expect(getCta(container).textContent).toMatch(/7\.600/));
		await fireEvent.click(getCta(container));
		await waitFor(() => expect(container.textContent).toContain('Cupón expirado'));
		await waitFor(() => expect(getCheckoutQuoteMock).toHaveBeenCalledTimes(3));
		expect(getCheckoutQuoteMock.mock.calls[2][0].couponCode).toBeUndefined();
		expect(gotoMock).not.toHaveBeenCalled();
	});

	it('strips non-digits from the phone field and caps it at 10 digits', async () => {
		const { container } = render(Delivery, { props: makeProps() });
		const phone = $(container, '#delivery-phone');
		await fireEvent.input(phone, { target: { value: '+57 300 123 4567' } });
		expect(phone.value).toBe('3001234567');
	});

	it('shows per-field validation errors on submit and does not call the API', async () => {
		const { container } = render(Delivery, { props: makeProps() });
		// Force the CTA to fire even while disabled, mirroring an invalid submit attempt.
		const cta = getCta(container);
		cta.disabled = false;
		await fireEvent.click(cta);

		await waitFor(() => expect(container.querySelector('#delivery-name-error')).toBeTruthy());
		expect(container.querySelector('#delivery-phone-error')).toBeTruthy();
		expect(container.querySelector('#delivery-address-error')).toBeTruthy();
		expect($(container, '#delivery-name').getAttribute('aria-invalid')).toBe('true');
		expect(createCheckoutMock).not.toHaveBeenCalled();
	});

	it('clears a field error once the field becomes valid', async () => {
		const { container } = render(Delivery, { props: makeProps() });
		const cta = getCta(container);
		cta.disabled = false;
		await fireEvent.click(cta);
		await waitFor(() => expect(container.querySelector('#delivery-name-error')).toBeTruthy());

		await fireEvent.input($(container, '#delivery-name'), { target: { value: 'Juan Pérez' } });
		await waitFor(() => expect(container.querySelector('#delivery-name-error')).toBeFalsy());
		expect(container.querySelector('#delivery-phone-error')).toBeTruthy();
	});
});
