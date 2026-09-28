import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import { locale, waitLocale } from 'svelte-i18n';
import CouponField from '../molecules/CouponField.svelte';

const applyButton = (container: HTMLElement) =>
	container.querySelector('button') as HTMLButtonElement;
const input = (container: HTMLElement) =>
	container.querySelector('#delivery-coupon') as HTMLInputElement;

describe('CouponField', () => {
	beforeEach(async () => {
		locale.set('es');
		await waitLocale();
	});

	it('keeps APLICAR disabled until a code is typed, uppercases it, and applies on click or Enter', async () => {
		const onApply = vi.fn();
		const onEdit = vi.fn();
		const { container } = render(CouponField, { props: { onApply, onEdit } });
		expect(input(container).placeholder).toBe('Ingresa tu cupón');
		expect(applyButton(container).disabled).toBe(true);

		await fireEvent.input(input(container), { target: { value: 'algramo10' } });
		expect(input(container).value).toBe('ALGRAMO10');
		expect(onEdit).toHaveBeenCalledOnce();
		expect(applyButton(container).disabled).toBe(false);

		await fireEvent.click(applyButton(container));
		await fireEvent.keyDown(input(container), { key: 'Enter' });
		expect(onApply).toHaveBeenCalledTimes(2);
	});

	it('shows the success line, or the error with aria-invalid', () => {
		const ok = render(CouponField, {
			props: { value: 'X', success: '¡Cupón aplicado!', onApply: vi.fn() }
		});
		expect(ok.container.textContent).toContain('¡Cupón aplicado!');
		ok.unmount();

		const bad = render(CouponField, {
			props: { value: 'X', error: 'Cupón expirado', onApply: vi.fn() }
		});
		expect(bad.container.textContent).toContain('Cupón expirado');
		expect(input(bad.container).getAttribute('aria-invalid')).toBe('true');
	});
});
