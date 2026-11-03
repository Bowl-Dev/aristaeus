import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor } from '@testing-library/svelte';
import { locale, waitLocale } from 'svelte-i18n';
import type { AdminOrder } from '$lib/types';

const { listOrdersMock } = vi.hoisted(() => ({ listOrdersMock: vi.fn() }));

vi.mock('$lib/api/client', () => ({
	listOrders: listOrdersMock,
	updateOrderStatus: vi.fn(),
	ApiError: class extends Error {}
}));

import OrdersPage from '../admin/orders/+page.svelte';

const order = (over: Partial<AdminOrder> = {}): AdminOrder => ({
	id: 1,
	orderNumber: 4342,
	bowlSize: 450,
	includeCutlery: false,
	user: {
		id: 'u1',
		name: 'Ana',
		phone: '3001234567',
		email: null,
		address: {} as AdminOrder['user']['address']
	},
	status: 'pending',
	items: [],
	totalWeightG: 400,
	totalCalories: 500,
	totalProteinG: 0,
	totalCarbsG: 0,
	totalFatG: 0,
	totalFiberG: 0,
	totalPrice: 20000,
	deliveryFee: 0,
	discount: null,
	amountDue: 20000,
	pickup: null,
	createdAt: '2026-11-01T12:00:00Z',
	assignedAt: null,
	startedAt: null,
	completedAt: null,
	...over
});

describe('/admin/orders price breakdown', () => {
	beforeEach(async () => {
		listOrdersMock.mockReset();
		locale.set('es');
		await waitLocale();
	});

	it('explains a pickup order is not delivered, keeping Domicilio $0', async () => {
		listOrdersMock.mockResolvedValue({
			orders: [order({ pickup: { name: 'Oficina', location: 'Calle 1', date: '2026-11-04' } })],
			total: 1
		});
		const { container } = render(OrdersPage);
		await waitFor(() =>
			expect(container.textContent).toContain(
				'Pedido para recoger en Oficina: no se envía a domicilio'
			)
		);
		expect(container.textContent).toContain('Domicilio');
		expect(container.textContent).toContain('Pedido para recoger en punto, no es domicilio');
		expect(container.textContent).toContain('Oficina · Calle 1');
	});

	it('shows no pickup note for a delivery order', async () => {
		listOrdersMock.mockResolvedValue({ orders: [order()], total: 1 });
		const { container } = render(OrdersPage);
		await waitFor(() => expect(container.textContent).toContain('Domicilio'));
		expect(container.textContent).not.toContain('Pedido para recoger');
	});
});
