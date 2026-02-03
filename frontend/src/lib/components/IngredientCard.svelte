<script lang="ts">
	import type { Ingredient } from '$lib/types';
	import { _ } from 'svelte-i18n';

	// Props
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
	let blockCat = true;
</script>

<div
	class="ingredient-card"
	class:selected={isSelected}
	onclick={() => {
		if (!isSelected) {
			onSelect();
		}
		if (ingredientCategory === $_('ingredients.categories.dressing')) {
			blockCat = false;
		}
	}}
	role="button"
	tabindex="0"
	onkeydown={(e) => {
		if ((e.key === 'Enter' || e.key === ' ') && !isSelected) {
			e.preventDefault();
			onSelect();
		}
	}}
>
	<div class="card-header">
		<h4 class="ingredient-name">{ingredientName}</h4>
		{#if isSelected}
			<button
				class="remove-btn"
				onclick={(e) => {
					e.stopPropagation();
					onRemove();
				}}
				type="button"
				aria-label={$_('ingredientCard.remove', { values: { name: ingredientName } })}
			>
				×
			</button>
		{/if}
	</div>

	<div class="card-nutrition">
		<div class="nutrition-badge">
			<span class="badge-value">{ingredient.caloriesPer100g}</span>
			<span class="badge-label">{$_('ingredientCard.cal')} /100g</span>
		</div>
		<div class="nutrition-badge">
			<span class="badge-value">{ingredient.proteinGPer100g}g</span>
			<span class="badge-label">{$_('ingredientCard.protein')} /100g</span>
		</div>
		<div class="nutrition-badge">
			<span class="badge-value">{Math.round(ingredient.pricePerG)}</span>
			<span class="badge-label">$COP/g</span>
		</div>
	</div>

	{#if isSelected}
		{#if blockCat}
			<div class="card-quantity" onclick={(e) => e.stopPropagation()}>
				<label for="qty-{ingredient.id}" class="quantity-label"
					>{$_('ingredientCard.quantity')}</label
				>
				<div class="quantity-controls">
					<button
						class="qty-btn"
						onclick={() => onQuantityChange(Math.max(0, quantity - 10))}
						type="button"
						aria-label="Decrease quantity"
					>
						−
					</button>
					<input
						id="qty-{ingredient.id}"
						type="number"
						min="10"
						step="10"
						value={quantity}
						oninput={(e) => onQuantityChange(Number(e.currentTarget.value))}
						class="qty-input"
					/>
					<button
						class="qty-btn"
						onclick={() => onQuantityChange(quantity + 10)}
						type="button"
						aria-label="Increase quantity"
					>
						+
					</button>
				</div>
				<span class="unit">{$_('ingredientCard.grams')}</span>
			</div>
		{:else}
			<div class="card-quantity" onclick={(e) => e.stopPropagation()}>
				<label for="qty-{ingredient.id}" class="quantity-label"
					>{$_('ingredientCard.quantity')}</label
				>
				<div class="quantity-controls">
					<button
						class="qty-btn"
						onclick={() => onQuantityChange(Math.max(0, quantity - 25))}
						type="button"
						aria-label="Decrease quantity"
					>
						−
					</button>
					<input
						id="qty-{ingredient.id}"
						type="number"
						min="1"
						step="1"
						value={quantity / 25}
						oninput={(e) => onQuantityChange(Number(e.currentTarget.value))}
						class="qty-input"
					/>
					<button
						class="qty-btn"
						onclick={() => onQuantityChange(quantity + 25)}
						type="button"
						aria-label="Increase quantity"
					>
						+
					</button>
				</div>
				<span class="unit">{$_('ingredientCard.units')} (1u = 25g)</span>
			</div>
		{/if}
	{:else}
		<p class="select-hint">{$_('ingredientCard.clickToAdd')}</p>
	{/if}
</div>

<style>
	.ingredient-card {
		background: #fff;
		border: 2px solid #ecf0f1;
		border-radius: 12px;
		padding: 1rem;
		cursor: pointer;
		transition: all 0.3s ease;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		box-sizing: border-box;
		overflow: visible;
	}

	.ingredient-card:hover {
		border-color: #16a085;
		transform: translateY(-2px);
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
	}

	.ingredient-card.selected {
		border-color: #16a085;
		background: #e8f8f5;
		box-shadow: 0 4px 12px rgba(22, 160, 133, 0.15);
	}

	.card-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 0.5rem;
	}

	.ingredient-name {
		font-size: 1rem;
		font-weight: 700;
		color: #2c3e50;
		margin: 0;
		flex: 1;
	}

	.remove-btn {
		background: #e74c3c;
		color: white;
		border: none;
		border-radius: 50%;
		width: 24px;
		height: 24px;
		font-size: 1.25rem;
		line-height: 1;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: background 0.2s;
		flex-shrink: 0;
	}

	.remove-btn:hover {
		background: #c0392b;
	}

	.card-nutrition {
		display: flex;
		gap: 0.75rem;
	}

	.nutrition-badge {
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: 0.5rem;
		background: #f8f9fa;
		border-radius: 6px;
		flex: 1;
	}

	.badge-value {
		font-size: 1rem;
		font-weight: 700;
		color: #16a085;
	}

	.badge-label {
		font-size: 0.75rem;
		color: #7f8c8d;
		text-transform: uppercase;
	}

	.ingredient-card.selected .nutrition-badge {
		background: #d5f4e6;
	}

	.card-quantity {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		padding-top: 0.5rem;
		border-top: 2px solid #ecf0f1;
		width: 100%;
		box-sizing: border-box;
	}

	.quantity-label {
		font-size: 0.875rem;
		font-weight: 600;
		color: #34495e;
	}

	.quantity-controls {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		width: 100%;
	}

	.qty-btn {
		background: #16a085;
		color: white;
		border: none;
		border-radius: 6px;
		width: 32px;
		height: 32px;
		min-width: 32px;
		font-size: 1.25rem;
		line-height: 1;
		cursor: pointer;
		transition: background 0.2s;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}

	.qty-btn:hover {
		background: #138d75;
	}

	.qty-input {
		flex: 1;
		min-width: 0;
		padding: 0.5rem;
		border: 2px solid #ecf0f1;
		border-radius: 6px;
		font-size: 1rem;
		text-align: center;
		font-weight: 600;
		color: #2c3e50;
	}

	.qty-input:focus {
		outline: none;
		border-color: #16a085;
	}

	.unit {
		font-size: 0.875rem;
		color: #7f8c8d;
		font-weight: 600;
		text-align: center;
	}

	.select-hint {
		text-align: center;
		color: #95a5a6;
		font-size: 0.875rem;
		font-style: italic;
		margin: 0;
	}

	.ingredient-card:hover .select-hint {
		color: #16a085;
	}
</style>
