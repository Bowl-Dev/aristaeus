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
	total: 9000,
	pickup: null
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

	it('shows the AG number as the title and the delivery ETA, fetched once', async () => {
		getCheckoutStatusMock.mockResolvedValue(received);
		const { container } = visit('?c=chk-1');
		await waitFor(() => expect(container.querySelector('h1')?.textContent).toContain('AG-4342'));
		expect(getCheckoutStatusMock).toHaveBeenCalledOnce();
		expect(getCheckoutStatusMock).toHaveBeenCalledWith('chk-1');
		expect(container.textContent).toContain('Pedido confirmado');
		expect(container.textContent).toContain('Tiempo estimado');
		expect(container.textContent).toContain('25 – 35 min');
		expect(container.textContent).not.toContain('Punto de recogida');
		expect(container.textContent).toContain('Volver al inicio');
	});

	it('shows the pickup point and date for a pickup checkout', async () => {
		getCheckoutStatusMock.mockResolvedValue({
			...received,
			pickup: { name: 'Oficina', location: 'Calle 1', hours: '12:00 – 14:00', date: '2026-09-02' }
		});
		const { container } = visit('?c=chk-1');
		await waitFor(() => expect(container.textContent).toContain('Punto de recogida'));
		expect(container.textContent).toContain('Oficina · Calle 1');
		expect(container.textContent).toContain('Fecha y hora');
		expect(container.textContent).toContain('miércoles, 2 de septiembre · 12:00 – 14:00');
		expect(container.textContent).not.toContain('Tiempo estimado');
	});

	it('links WhatsApp with the AG number prefilled', async () => {
		getCheckoutStatusMock.mockResolvedValue(received);
		const { container } = visit('?c=chk-1');
		await waitFor(() => expect(container.textContent).toContain('AG-4342'));
		const link = container.querySelector('a[href^="https://wa.me/"]');
		expect(link?.textContent).toContain('¿Tienes preguntas? Escríbenos');
		expect(link?.getAttribute('target')).toBe('_blank');
		expect(link?.getAttribute('href')).toBe(
			`https://wa.me/573024712948?text=${encodeURIComponent('Hola alGramo, tengo una pregunta sobre mi pedido AG-4342')}`
		);
	});

	it('shows a friendly error and a generic WhatsApp link when c is missing', async () => {
		const { container } = visit('');
		await waitFor(() => expect(container.textContent).toContain('No encontramos tu pedido'));
		expect(getCheckoutStatusMock).not.toHaveBeenCalled();
		expect(container.querySelector('a[href^="https://wa.me/"]')?.getAttribute('href')).toBe(
			`https://wa.me/573024712948?text=${encodeURIComponent('Hola alGramo, tengo una pregunta sobre mi pedido')}`
		);
	});

	it('shows a friendly error when the checkout is unknown', async () => {
		getCheckoutStatusMock.mockRejectedValue(new FakeApiError(404, 'Not found'));
		const { container } = visit('?c=nope');
		await waitFor(() => expect(container.textContent).toContain('No encontramos tu pedido'));
	});
});
