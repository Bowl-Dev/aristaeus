import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, waitFor } from '@testing-library/svelte';
import { locale, waitLocale } from 'svelte-i18n';

const { getCheckoutStatusMock, FakeApiError } = vi.hoisted(() => {
	class FakeApiError extends Error {
		status: number;
		constructor(status: number, message: string) {
			super(message);
			this.status = status;
		}
	}
	return { getCheckoutStatusMock: vi.fn(), FakeApiError };
});

vi.mock('$lib/api/client', () => ({
	getCheckoutStatus: getCheckoutStatusMock,
	ApiError: FakeApiError
}));

import OrderPage from '../order/+page.svelte';

const status = (paymentStatus: string) => ({
	checkoutId: 'chk-1',
	orderNumber: 4342,
	paymentStatus,
	total: 9000
});

function visit(search: string) {
	window.history.replaceState({}, '', `/order${search}`);
	return render(OrderPage);
}

describe('/order', () => {
	beforeEach(async () => {
		getCheckoutStatusMock.mockReset();
		locale.set('es');
		await waitLocale();
	});

	afterEach(() => vi.useRealTimers());

	it('shows the confirmed design once the checkout is paid', async () => {
		getCheckoutStatusMock.mockResolvedValue(status('paid'));
		const { container } = visit('?c=chk-1&id=wompi-tx');
		await waitFor(() => expect(container.textContent).toContain('¡Gracias por tu pedido!'));
		expect(getCheckoutStatusMock).toHaveBeenCalledWith('chk-1');
		expect(container.textContent).toContain('AG-4342');
		expect(container.textContent).toContain('En preparación');
		expect(container.textContent).toContain('25 – 35 min');
		expect(container.textContent).toContain('Volver al inicio');
	});

	it('shows the not-approved state when the payment failed', async () => {
		getCheckoutStatusMock.mockResolvedValue(status('payment_failed'));
		const { container } = visit('?c=chk-1');
		await waitFor(() => expect(container.textContent).toContain('Tu pago no fue aprobado'));
		expect(container.textContent).toContain('AG-4342');
		expect(container.textContent).not.toContain('25 – 35 min');
	});

	it('polls every 2 s and offers a refresh once it gives up while still awaiting payment', async () => {
		vi.useFakeTimers();
		getCheckoutStatusMock.mockResolvedValue(status('awaiting_payment'));
		const { container } = visit('?c=chk-1');
		await vi.advanceTimersByTimeAsync(0);
		expect(container.textContent).toContain('Estamos confirmando tu pago');
		await vi.advanceTimersByTimeAsync(2000);
		expect(getCheckoutStatusMock).toHaveBeenCalledTimes(2);
		expect(container.textContent).not.toContain('Actualizar estado');
		await vi.advanceTimersByTimeAsync(60_000);
		expect(getCheckoutStatusMock).toHaveBeenCalledTimes(30);
		expect(container.textContent).toContain('AG-4342');
		expect(container.textContent).toContain('Actualizar estado');
	});

	it('shows a friendly error when c is missing', async () => {
		const { container } = visit('');
		await waitFor(() => expect(container.textContent).toContain('No encontramos tu pedido'));
		expect(getCheckoutStatusMock).not.toHaveBeenCalled();
	});

	it('shows a friendly error when the checkout is unknown', async () => {
		getCheckoutStatusMock.mockRejectedValue(new FakeApiError(404, 'Not found'));
		const { container } = visit('?c=nope');
		await waitFor(() => expect(container.textContent).toContain('No encontramos tu pedido'));
	});
});
