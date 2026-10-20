import { describe, it, expect, vi, beforeEach } from 'vitest';
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

const received = {
	checkoutId: 'chk-1',
	orderNumber: 4342,
	paymentStatus: 'not_required',
	total: 9000
};

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

	it('shows the received order with its AG number, fetched once', async () => {
		getCheckoutStatusMock.mockResolvedValue(received);
		const { container } = visit('?c=chk-1');
		await waitFor(() => expect(container.textContent).toContain('AG-4342'));
		expect(getCheckoutStatusMock).toHaveBeenCalledOnce();
		expect(getCheckoutStatusMock).toHaveBeenCalledWith('chk-1');
		expect(container.textContent).toContain('Pedido recibido');
		expect(container.textContent).toContain('¡Gracias por tu pedido!');
		expect(container.textContent).toContain('25 – 35 min');
		expect(container.textContent).toContain('Volver al inicio');
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
