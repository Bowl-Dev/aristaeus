<script lang="ts">
	import type { NutritionalSummary, BowlSize } from '$lib/types';
	import CapacityBar from './CapacityBar.svelte';
	import { _ } from 'svelte-i18n';

	interface Props {
		nutrition: NutritionalSummary;
		bowlSize: BowlSize | null;
	}

	let { nutrition, bowlSize }: Props = $props();
</script>

<section class="mb-8 pb-8 border-b border-surface-300 dark:border-surface-700">
	<h2 class="text-2xl font-bold mb-4">{$_('nutrition.title')}</h2>

	{#if bowlSize}
		<CapacityBar currentWeight={nutrition.totalWeightG} {bowlSize} />
	{/if}

	<div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-4">
		<div class="card bg-primary-500/20 border border-primary-500 rounded-xl p-4 text-center">
			<span class="block text-sm text-surface-500 uppercase font-semibold mb-1"
				>{$_('nutrition.totalWeight')}</span
			>
			<span class="block text-2xl font-bold text-primary-500"
				>{nutrition.totalWeightG.toFixed(0)}g</span
			>
		</div>
		<div class="card bg-primary-500/20 border border-primary-500 rounded-xl p-4 text-center">
			<span class="block text-sm text-surface-500 uppercase font-semibold mb-1"
				>{$_('nutrition.calories')}</span
			>
			<span class="block text-2xl font-bold text-primary-500">{nutrition.calories.toFixed(0)}</span>
		</div>
		<div
			class="card bg-surface-200 dark:bg-surface-700 border border-surface-300 dark:border-surface-600 rounded-xl p-4 text-center"
		>
			<span class="block text-sm text-surface-500 uppercase font-semibold mb-1"
				>{$_('nutrition.protein')}</span
			>
			<span class="block text-2xl font-bold">{nutrition.proteinG.toFixed(1)}g</span>
		</div>
		<div
			class="card bg-surface-200 dark:bg-surface-700 border border-surface-300 dark:border-surface-600 rounded-xl p-4 text-center"
		>
			<span class="block text-sm text-surface-500 uppercase font-semibold mb-1"
				>{$_('nutrition.carbs')}</span
			>
			<span class="block text-2xl font-bold">{nutrition.carbsG.toFixed(1)}g</span>
		</div>
		<div
			class="card bg-surface-200 dark:bg-surface-700 border border-surface-300 dark:border-surface-600 rounded-xl p-4 text-center"
		>
			<span class="block text-sm text-surface-500 uppercase font-semibold mb-1"
				>{$_('nutrition.fat')}</span
			>
			<span class="block text-2xl font-bold">{nutrition.fatG.toFixed(1)}g</span>
		</div>
		<div
			class="card bg-surface-200 dark:bg-surface-700 border border-surface-300 dark:border-surface-600 rounded-xl p-4 text-center"
		>
			<span class="block text-sm text-surface-500 uppercase font-semibold mb-1"
				>{$_('nutrition.fiber')}</span
			>
			<span class="block text-2xl font-bold">{nutrition.fiberG.toFixed(1)}g</span>
		</div>
	</div>

	<div class="card bg-primary-500 text-white rounded-xl p-4 text-center">
		<span class="block text-sm uppercase font-semibold mb-1">Precio</span>
		<span class="block text-3xl font-bold">{Math.round(nutrition.totalPrice / 100) * 100}$COP</span>
	</div>
</section>
