import { describe, it, expect, beforeEach } from 'vitest';
import { render, fireEvent, waitFor } from '@testing-library/svelte';
import { locale, waitLocale } from 'svelte-i18n';
import type { CheckoutQuote } from '$lib/types';
import CheckoutSummary from '../organisms/CheckoutSummary.svelte';

const quote: CheckoutQuote = {
	subtotal: 1800,
	deliveryFee: 5000,
	discount: 0,
	serviceFee: 1000,
	total: 7800,
	coupon: null,
	couponRejection: null
};

const props = (q: CheckoutQuote | null = quote) => ({
	lines: [{ label: 'Bowl', amount: 1800 }],
	quote: q,
	subtotal: 1800,
	hint: 'Ingresa tu dirección'
});

const sheetTitle = '¿Por qué el valor del domicilio puede ser diferente?';

describe('CheckoutSummary', () => {
	beforeEach(async () => {
		locale.set('es');
		await waitLocale();
	});

	it('shows the delivery fee and the zone note once quoted', () => {
		const { container } = render(CheckoutSummary, { props: props() });
		expect(container.textContent).toMatch(/5\.000/);
		expect(container.textContent).toContain('se calcula según tu zona de entrega');
	});

	it('hides the note before a quote', () => {
		const { container } = render(CheckoutSummary, { props: props(null) });
		expect(container.textContent).not.toContain('Conoce más');
	});

	it.each([
		[
			'the info button',
			(c: HTMLElement) => c.querySelector('[aria-label="Más información sobre el costo de envío"]')
		],
		[
			'"Conoce más"',
			(c: HTMLElement) =>
				Array.from(c.querySelectorAll('button')).find((b) => b.textContent?.trim() === 'Conoce más')
		]
	])('%s opens the delivery fee sheet', async (_name, pick) => {
		const { container } = render(CheckoutSummary, { props: props() });
		expect(document.body.textContent).not.toContain(sheetTitle);
		await fireEvent.click(pick(container) as HTMLElement);
		await waitFor(() => expect(document.body.textContent).toContain(sheetTitle));
		expect(document.body.textContent).toContain('Entendido');
	});

	it('free shipping strikes the fee, shows Gratis and no coupon −amount', () => {
		const { container, getByTestId } = render(CheckoutSummary, {
			props: props({
				...quote,
				discount: 5000,
				total: 2800,
				coupon: { code: 'ENVIOGRATIS', type: 'free_shipping', value: null }
			})
		});
		const fee = getByTestId('free-shipping');
		expect(fee.querySelector('s')?.textContent).toMatch(/5\.000/);
		expect(fee.textContent).toContain('Gratis');
		const couponRow = getByTestId('coupon-row');
		expect(couponRow.textContent).toContain('ENVIOGRATIS');
		expect(couponRow.textContent).not.toContain('−');
		expect(container.textContent).toMatch(/2\.800/);
	});
});
