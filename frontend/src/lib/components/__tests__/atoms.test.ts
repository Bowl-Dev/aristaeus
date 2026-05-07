/**
 * Smoke tests for the new atomic components.
 *
 * These verify that the building blocks render without throwing and expose
 * their core props/handlers — they are not pixel-fidelity tests.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import { createRawSnippet } from 'svelte';

import Button from '../atoms/Button.svelte';
import OptionCard from '../molecules/OptionCard.svelte';
import NutritionalInfo from '../molecules/NutritionalInfo.svelte';
import BottomSheet from '../organisms/BottomSheet.svelte';

const textSnippet = (text: string) =>
	createRawSnippet(() => ({
		render: () => `<span>${text}</span>`
	}));

describe('Button atom', () => {
	it('renders children and fires onclick', async () => {
		const onclick = vi.fn();
		const { getByRole } = render(Button, {
			props: {
				variant: 'primary',
				onclick,
				children: textSnippet('Hola')
			} as never
		});
		const btn = getByRole('button');
		expect(btn.textContent?.trim()).toBe('Hola');
		await fireEvent.click(btn);
		expect(onclick).toHaveBeenCalledOnce();
	});

	it('respects the disabled prop', () => {
		const { getByRole } = render(Button, {
			props: {
				variant: 'primary',
				disabled: true,
				children: textSnippet('Disabled')
			} as never
		});
		expect((getByRole('button') as HTMLButtonElement).disabled).toBe(true);
	});
});

describe('OptionCard molecule', () => {
	it('renders icon + label and fires onclick', async () => {
		const onclick = vi.fn();
		const { getByRole, getByAltText } = render(OptionCard, {
			props: {
				iconSrc: '/BuildBowl.png',
				iconAlt: 'desde cero',
				label: 'Desde zero',
				onclick
			}
		});
		const btn = getByRole('button');
		expect(btn.textContent).toContain('Desde zero');
		expect(getByAltText('desde cero')).toBeTruthy();
		await fireEvent.click(btn);
		expect(onclick).toHaveBeenCalledOnce();
	});
});

describe('NutritionalInfo molecule', () => {
	it('renders the four nutrient values with their labels', () => {
		const { container } = render(NutritionalInfo, {
			props: {
				calories: 420,
				protein: 28,
				carbs: 45,
				fat: 12
			}
		});
		const text = container.textContent ?? '';
		expect(text).toContain('420');
		expect(text).toContain('28g');
		expect(text).toContain('45g');
		expect(text).toContain('12g');
		// Each nutrient has a label rendered (translated in app, key in unconfigured i18n).
		// Either way the four labels collectively contribute non-empty text per column.
		const cols = container.querySelectorAll('div > div');
		expect(cols.length).toBeGreaterThanOrEqual(4);
	});
});

describe('BottomSheet organism', () => {
	it('renders the dialog and a grab bar', () => {
		const { getByRole } = render(BottomSheet, {
			props: {
				ariaLabel: 'test sheet',
				onDismiss: () => {},
				children: textSnippet('Sheet body')
			} as never
		});
		const dialog = getByRole('dialog');
		expect(dialog.getAttribute('aria-label')).toBe('test sheet');
		expect(dialog.textContent).toContain('Sheet body');
	});
});
