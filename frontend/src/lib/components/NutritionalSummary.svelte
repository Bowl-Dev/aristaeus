<script lang="ts">
	import type { NutritionalSummary, BowlSize } from '$lib/types';
	import CapacityBar from './CapacityBar.svelte';
	import { _ } from 'svelte-i18n';

	// Props
	interface Props {
		nutrition: NutritionalSummary;
		bowlSize: BowlSize | null;
		//totalPrice: number;
	}

	let { nutrition, bowlSize}: Props = $props();	
</script>

<section class="nutritional-summary">
	<h2>{$_('nutrition.title')}</h2>

	<!-- Bowl Capacity Bar -->
	{#if bowlSize}
		<CapacityBar currentWeight={nutrition.totalWeightG} bowlSize={bowlSize} />
	{/if}

	<div class="nutrition-grid">
		<div class="nutrition-item highlight">
			<span class="label">{$_('nutrition.totalWeight')}</span>
			<span class="value">{nutrition.totalWeightG.toFixed(0)}g</span>
		</div>
		<div class="nutrition-item highlight">
			<span class="label">{$_('nutrition.calories')}</span>
			<span class="value">{nutrition.calories.toFixed(0)}</span>
		</div>
		<div class="nutrition-item">
			<span class="label">{$_('nutrition.protein')}</span>
			<span class="value">{nutrition.proteinG.toFixed(1)}g</span>
		</div>
		<div class="nutrition-item">
			<span class="label">{$_('nutrition.carbs')}</span>
			<span class="value">{nutrition.carbsG.toFixed(1)}g</span>
		</div>
		<div class="nutrition-item">
			<span class="label">{$_('nutrition.fat')}</span>
			<span class="value">{nutrition.fatG.toFixed(1)}g</span>
		</div>
		<div class="nutrition-item">
			<span class="label">{$_('nutrition.fiber')}</span>
			<span class="value">{nutrition.fiberG.toFixed(1)}g</span>
		</div>
	</div>

	<div class="nutrition-item">
			<span class="label">Precio</span>
			<span class="value">{Math.round(nutrition.totalPrice/100)*100}$COP</span>
	</div>
</section>

<style>
	.nutritional-summary {
		margin-bottom: 2rem;
		padding-bottom: 2rem;
		border-bottom: 1px solid #ecf0f1;
	}

	h2 {
		color: #34495e;
		font-size: 1.5rem;
		margin-bottom: 1rem;
	}

	.nutrition-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
		gap: 1rem;
	}

	.nutrition-item {
		display: flex;
		flex-direction: column;
		padding: 1rem;
		background: #f8f9fa;
		border-radius: 4px;
		text-align: center;
	}

	.nutrition-item.highlight {
		background: #e8f8f5;
		border: 2px solid #16a085;
	}

	.nutrition-item .label {
		font-size: 0.875rem;
		color: #7f8c8d;
		margin-bottom: 0.5rem;
		text-transform: uppercase;
		font-weight: 600;
	}

	.nutrition-item .value {
		font-size: 1.5rem;
		font-weight: 700;
		color: #2c3e50;
	}

	.nutrition-item.highlight .value {
		color: #16a085;
	}

	/* Responsive Design */
	@media (max-width: 768px) {
		.nutrition-grid {
			grid-template-columns: repeat(2, 1fr);
		}
	}
</style>
