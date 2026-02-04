<script lang="ts">
	import type { Ingredient } from '$lib/types';
	import { _ } from 'svelte-i18n';

	interface Props {
		ingredient: Ingredient;
		ingredientName: string;
		ingredientCategory: string;
		isSelected: boolean;
		quantity: number;
		onSelect: () => void;
		onRemove: () => void;
		onQuantityChange: (quantity: number) => void;
	}

	let {
		ingredient,
		ingredientName,
		ingredientCategory,
		isSelected,
		quantity,
		onSelect,
		onRemove,
		onQuantityChange
	}: Props = $props();

	let blockCat = $state(true);
</script>

<button
	class="card p-4 flex flex-col gap-3 transition-all duration-300 text-left w-full rounded-xl {isSelected
		? 'bg-primary-500/20 ring-2 ring-primary-500 border border-primary-500'
		: 'bg-surface-200 dark:bg-surface-700 border border-surface-300 dark:border-surface-600 hover:border-primary-500 hover:-translate-y-1'}"
	onclick={() => {
		if (!isSelected) {
			onSelect();
		}
		if (ingredientCategory === $_('ingredients.categories.dressing')) {
			blockCat = false;
		}
	}}
	type="button"
>
	<div class="flex justify-between items-start gap-2">
		<h4 class="font-bold">{ingredientName}</h4>
		{#if isSelected}
			<button
				class="btn-icon bg-error-500 hover:bg-error-600 text-white size-6 text-sm rounded-full"
				onclick={(e) => {
					e.stopPropagation();
					onRemove();
				}}
				type="button"
				aria-label={$_('ingredientCard.remove', { values: { name: ingredientName } })}
			>
				&times;
			</button>
		{/if}
	</div>

	<div class="flex gap-2">
		<div class="flex flex-col items-center p-2 bg-surface-200 dark:bg-surface-700 rounded flex-1">
			<span class="font-bold text-primary-500">{ingredient.caloriesPer100g}</span>
			<span class="text-xs text-surface-500 uppercase">{$_('ingredientCard.cal')} /100g</span>
		</div>
		<div class="flex flex-col items-center p-2 bg-surface-200 dark:bg-surface-700 rounded flex-1">
			<span class="font-bold text-primary-500">{ingredient.proteinGPer100g}g</span>
			<span class="text-xs text-surface-500 uppercase">{$_('ingredientCard.protein')} /100g</span>
		</div>
		<div class="flex flex-col items-center p-2 bg-surface-200 dark:bg-surface-700 rounded flex-1">
			<span class="font-bold text-primary-500">{Math.round(ingredient.pricePerG)}</span>
			<span class="text-xs text-surface-500 uppercase">$COP/g</span>
		</div>
	</div>

	{#if isSelected}
		{#if blockCat}
			<div
				class="flex flex-col gap-2 pt-2 border-t border-surface-300 dark:border-surface-600"
				onclick={(e) => e.stopPropagation()}
			>
				<label for="qty-{ingredient.id}" class="text-sm font-semibold"
					>{$_('ingredientCard.quantity')}</label
				>
				<div class="flex items-center gap-2">
					<button
						class="btn-icon bg-primary-500 hover:bg-primary-600 text-white size-8 rounded-lg font-bold"
						onclick={() => onQuantityChange(Math.max(0, quantity - 10))}
						type="button"
						aria-label="Decrease quantity"
					>
						-
					</button>
					<input
						id="qty-{ingredient.id}"
						type="number"
						min="10"
						step="10"
						value={quantity}
						oninput={(e) => onQuantityChange(Number(e.currentTarget.value))}
						class="input text-center font-semibold flex-1 bg-surface-50 dark:bg-surface-800 border-surface-300 dark:border-surface-600 rounded-lg"
					/>
					<button
						class="btn-icon bg-primary-500 hover:bg-primary-600 text-white size-8 rounded-lg font-bold"
						onclick={() => onQuantityChange(quantity + 10)}
						type="button"
						aria-label="Increase quantity"
					>
						+
					</button>
				</div>
				<span class="text-sm text-surface-500 font-semibold text-center"
					>{$_('ingredientCard.grams')}</span
				>
			</div>
		{:else}
			<div
				class="flex flex-col gap-2 pt-2 border-t border-surface-300 dark:border-surface-600"
				onclick={(e) => e.stopPropagation()}
			>
				<label for="qty-{ingredient.id}" class="text-sm font-semibold"
					>{$_('ingredientCard.quantity')}</label
				>
				<div class="flex items-center gap-2">
					<button
						class="btn-icon bg-primary-500 hover:bg-primary-600 text-white size-8 rounded-lg font-bold"
						onclick={() => onQuantityChange(Math.max(0, quantity - 25))}
						type="button"
						aria-label="Decrease quantity"
					>
						-
					</button>
					<input
						id="qty-{ingredient.id}"
						type="number"
						min="1"
						step="1"
						value={quantity / 25}
						oninput={(e) => onQuantityChange(Number(e.currentTarget.value))}
						class="input text-center font-semibold flex-1 bg-surface-50 dark:bg-surface-800 border-surface-300 dark:border-surface-600 rounded-lg"
					/>
					<button
						class="btn-icon bg-primary-500 hover:bg-primary-600 text-white size-8 rounded-lg font-bold"
						onclick={() => onQuantityChange(quantity + 25)}
						type="button"
						aria-label="Increase quantity"
					>
						+
					</button>
				</div>
				<span class="text-sm text-surface-500 font-semibold text-center"
					>{$_('ingredientCard.units')} (1u = 25g)</span
				>
			</div>
		{/if}
	{:else}
		<p class="text-center text-surface-400 text-sm italic">{$_('ingredientCard.clickToAdd')}</p>
	{/if}
</button>
