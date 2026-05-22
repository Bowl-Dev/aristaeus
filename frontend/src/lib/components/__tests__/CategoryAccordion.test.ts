import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import CategoryAccordion from '../molecules/CategoryAccordion.svelte';
import type { Ingredient } from '$lib/types';

const ingredient: Ingredient = {
	id: 1,
	name: 'Avocado',
	nameEs: 'Aguacate',
	nameEn: 'Avocado',
	category: 'topping',
	caloriesPer100g: 160,
	proteinGPer100g: 2,
	carbsGPer100g: 9,
	fatGPer100g: 15,
	fiberGPer100g: 7,
	available: true,
	displayOrder: 1,
	pricePerG: 12
};

const makeProps = (overrides: Record<string, unknown> = {}) => ({
	label: 'Base',
	ingredients: [ingredient],
	selectedItems: new Map<number, number>(),
	remaining: 200,
	onAdd: vi.fn(),
	onIncrease: vi.fn(),
	onDecrease: vi.fn(),
	onRemove: vi.fn(),
	...overrides
});

describe('CategoryAccordion', () => {
	it('is collapsed by default', () => {
		const { container } = render(CategoryAccordion, { props: makeProps() });
		expect(container.querySelector('[role="list"]')).toBeNull();
	});

	it('starts open when defaultOpen=true', () => {
		const { container } = render(CategoryAccordion, {
			props: makeProps({ defaultOpen: true })
		});
		expect(container.querySelector('[role="list"]')).not.toBeNull();
	});

	it('toggles open and closed when the header is clicked', async () => {
		const { container, getByRole } = render(CategoryAccordion, {
			props: makeProps()
		});
		const header = getByRole('button', { expanded: false });
		await fireEvent.click(header);
		expect(container.querySelector('[role="list"]')).not.toBeNull();
		await fireEvent.click(header);
		expect(container.querySelector('[role="list"]')).toBeNull();
	});

	it('does not auto-reopen after the user closes a category with selections', async () => {
		const selected = new Map<number, number>([[ingredient.id, 50]]);
		const { container, getByRole } = render(CategoryAccordion, {
			props: makeProps({ selectedItems: selected, defaultOpen: true })
		});
		expect(container.querySelector('[role="list"]')).not.toBeNull();
		const header = getByRole('button', { expanded: true });
		await fireEvent.click(header);
		expect(container.querySelector('[role="list"]')).toBeNull();
	});
});
