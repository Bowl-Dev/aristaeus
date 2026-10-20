import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, waitFor } from '@testing-library/svelte';
import { locale, waitLocale } from 'svelte-i18n';
import type { CouponRecord } from '$lib/types';

const { listMock, updateMock, deleteMock, FakeApiError } = vi.hoisted(() => {
	class FakeApiError extends Error {
		constructor(
			public status: number,
			message: string
		) {
			super(message);
		}
	}
	return { listMock: vi.fn(), updateMock: vi.fn(), deleteMock: vi.fn(), FakeApiError };
});

vi.mock('$lib/api/client', () => ({
	listCoupons: listMock,
	createCoupon: vi.fn(),
	updateCoupon: updateMock,
	deleteCoupon: deleteMock,
	ApiError: FakeApiError
}));

import CouponsPage from '../admin/coupons/+page.svelte';

const coupon = (over: Partial<CouponRecord> = {}): CouponRecord => ({
	id: 7,
	code: 'HOLA10',
	campaignName: 'Lanzamiento',
	description: null,
	type: 'percent',
	value: 10,
	startsAt: '2026-10-01T05:00:00.000Z',
	endsAt: '2026-11-01T04:59:59.000Z',
	budgetTotal: 100000,
	budgetRemaining: 100000,
	minBowls: 1,
	firstPurchaseOnly: false,
	active: true,
	createdAt: '2026-09-01T00:00:00Z',
	redemptions: 0,
	...over
});

const button = (c: HTMLElement, text: string) =>
	Array.from(c.querySelectorAll('button')).find((b) => b.textContent?.trim() === text)!;

describe('/admin/coupons', () => {
	beforeEach(async () => {
		listMock.mockReset();
		updateMock.mockReset();
		deleteMock.mockReset();
		localStorage.setItem('aristaeus.adminToken', 'tok');
		window.scrollTo = vi.fn() as typeof window.scrollTo;
		locale.set('es');
		await waitLocale();
	});

	it('prefills the form in Bogotá dates, locks used fields and PATCHes', async () => {
		const used = coupon({ redemptions: 3 });
		listMock.mockResolvedValue({ coupons: [used], count: 1 });
		updateMock.mockResolvedValue({ ...used, campaignName: 'Otra' });
		const { container } = render(CouponsPage);
		await waitFor(() => expect(container.textContent).toContain('HOLA10'));
		expect(button(container, 'Eliminar').disabled).toBe(true);

		await fireEvent.click(button(container, 'Editar'));
		const dates = container.querySelectorAll<HTMLInputElement>('input[type="date"]');
		expect(dates[0].value).toBe('2026-10-01');
		expect(dates[1].value).toBe('2026-10-31');
		expect(container.querySelector<HTMLSelectElement>('select')!.disabled).toBe(true);

		await fireEvent.submit(container.querySelector('form')!);
		await waitFor(() => expect(updateMock).toHaveBeenCalledOnce());
		const [id, body, token] = updateMock.mock.calls[0];
		expect([id, token]).toEqual([7, 'tok']);
		expect(body).toMatchObject({
			code: 'HOLA10',
			value: 10,
			description: null,
			startsAt: '2026-10-01T00:00:00-05:00',
			endsAt: '2026-10-31T23:59:59-05:00'
		});
		await waitFor(() => expect(container.textContent).toContain('Cupón HOLA10 actualizado.'));
	});

	it('deletes an unused coupon after confirm and shows server errors', async () => {
		listMock.mockResolvedValue({ coupons: [coupon()], count: 1 });
		vi.stubGlobal('confirm', () => true);
		deleteMock.mockRejectedValue(new FakeApiError(409, 'coupon_in_use'));
		const { container } = render(CouponsPage);
		await waitFor(() => expect(container.textContent).toContain('HOLA10'));
		await fireEvent.click(button(container, 'Eliminar'));
		expect(deleteMock).toHaveBeenCalledWith(7, 'tok');
		await waitFor(() => expect(container.textContent).toContain('Este cupón ya fue usado'));
		vi.unstubAllGlobals();
	});
});
