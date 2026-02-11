<script lang="ts">
	import { type Ingredient, type IngredientCategory, DRESSING_CONTAINER_GRAMS } from '$lib/types';
	import { gramsToImperial } from '$lib/utils/imperialConversion';
	import { slide } from 'svelte/transition';
	import { _ } from 'svelte-i18n';

	// Type definitions
	interface SelectedItem {
		ingredient: Ingredient;
		quantity: number;
	}

	interface Totals {
		calories: number;
		protein: number;
		weight: number;
		price: number;
	}

	// Props
	let {
		customerName,
		selectedBowlSize,
		selectedList,
		totals,
		capacityUsed,
		isOverCapacity,
		canSubmit,
		submitting,
		onSubmit
	}: {
		customerName: string;
		selectedBowlSize: number | null;
		selectedList: SelectedItem[];
		totals: Totals;
		capacityUsed: number;
		isOverCapacity: boolean;
		canSubmit: boolean;
		submitting: boolean;
		onSubmit: () => void;
	} = $props();

	// Helper functions
	function formatPrice(cop: number): string {
		return `$${Math.round(cop / 100) * 100}`;
	}

	function getIngredientName(name: string): string {
		return $_(`ingredients.${name}`) || name;
	}

	function formatImperial(quantity: string, unit: string): string {
		const translatedUnit = $_(`home.ingredient.${unit}`, { values: { quantity } });
		return `~${translatedUnit}`;
	}
</script>

<!-- Desktop: Order Summary Sidebar -->
<aside
	class="hidden lg:block fixed right-0 top-0 bottom-0 w-[420px] bg-white border-l border-gray-200"
>
	<div class="h-full flex flex-col p-6">
		<!-- Header -->
		<div class="mb-6">
			<h2 class="text-xl font-bold text-gray-900">{$_('home.order.title')}</h2>
			{#if customerName}
				<p class="text-sm text-gray-500 mt-1">
					{$_('home.order.for', { values: { name: customerName } })}
				</p>
			{/if}
		</div>

		<!-- Capacity Bar -->
		{#if selectedBowlSize}
			<div class="mb-6">
				<div class="flex justify-between text-sm mb-2">
					<span class="text-gray-500">{$_('home.order.capacity')}</span>
					<span class="font-medium {isOverCapacity ? 'text-red-600' : 'text-gray-900'}">
						{totals.weight}g / {selectedBowlSize}g
					</span>
				</div>
				<div class="h-2 bg-gray-100 rounded-full overflow-hidden">
					<div
						class="h-full rounded-full transition-all duration-300 {isOverCapacity
							? 'bg-red-500'
							: 'bg-gray-900'}"
						style="width: {Math.min(capacityUsed, 100)}%"
					></div>
				</div>
				{#if isOverCapacity}
					<p class="text-xs text-red-600 mt-1">
						{$_('home.order.overCapacity', {
							values: { amount: totals.weight - selectedBowlSize }
						})}
					</p>
				{/if}
			</div>
		{/if}

		<!-- Selected Items -->
		<div class="flex-1 overflow-y-auto min-h-0">
			{#if selectedList.length === 0}
				<div class="text-center py-12 text-gray-400">
					<svg
						class="w-12 h-12 mx-auto mb-3 opacity-50"
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="1.5"
							d="M12 6v6m0 0v6m0-6h6m-6 0H6"
						/>
					</svg>
					<p class="text-sm">{$_('home.order.noItems')}</p>
				</div>
			{:else}
				<ul class="space-y-2">
					{#each selectedList as { ingredient, quantity } (ingredient.id)}
						{@const isDressing = ingredient.category === 'dressing'}
						{@const containers = isDressing ? quantity / DRESSING_CONTAINER_GRAMS : null}
						{@const imperial = gramsToImperial(quantity, ingredient.category as IngredientCategory)}
						<li
							class="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg"
							transition:slide={{ duration: 150 }}
						>
							<span class="text-sm font-medium text-gray-900 truncate"
								>{getIngredientName(ingredient.name)}</span
							>
							<span class="text-sm text-gray-500 ml-2 shrink-0">
								{#if isDressing}
									{containers}
									{containers === 1
										? $_('home.ingredient.container')
										: $_('home.ingredient.containers')}
									({quantity}g)
								{:else}
									{quantity}g ({formatImperial(imperial.quantity, imperial.unit)})
								{/if}
							</span>
						</li>
					{/each}
				</ul>
			{/if}
		</div>

		<!-- Nutrition Summary -->
		{#if selectedList.length > 0}
			<div class="border-t border-gray-100 pt-4 mt-4">
				<div class="grid grid-cols-2 gap-3 text-center">
					<div class="bg-gray-50 rounded-lg py-3">
						<span class="block text-2xl font-bold text-gray-900">{Math.round(totals.calories)}</span
						>
						<span class="block text-xs text-gray-500 uppercase tracking-wide"
							>{$_('home.order.calories')}</span
						>
					</div>
					<div class="bg-gray-50 rounded-lg py-3">
						<span class="block text-2xl font-bold text-gray-900">{Math.round(totals.protein)}g</span
						>
						<span class="block text-xs text-gray-500 uppercase tracking-wide"
							>{$_('home.order.protein')}</span
						>
					</div>
				</div>
			</div>
		{/if}

		<!-- Price & Submit -->
		<div class="border-t border-gray-100 pt-4 mt-4">
			<div class="flex items-center justify-between mb-4">
				<span class="text-gray-500">{$_('home.order.total')}</span>
				<span class="text-2xl font-bold text-gray-900">{formatPrice(totals.price)} COP</span>
			</div>
			<button
				type="button"
				onclick={onSubmit}
				disabled={!canSubmit || submitting}
				class="w-full py-4 bg-gray-900 text-white rounded-xl font-semibold hover:bg-gray-800 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
			>
				{#if submitting}
					<span class="inline-flex items-center gap-2">
						<svg class="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
							<circle
								class="opacity-25"
								cx="12"
								cy="12"
								r="10"
								stroke="currentColor"
								stroke-width="4"
							></circle>
							<path
								class="opacity-75"
								fill="currentColor"
								d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
							></path>
						</svg>
						{$_('home.order.placingOrder')}
					</span>
				{:else}
					{$_('home.order.placeOrder')}
				{/if}
			</button>
		</div>
	</div>
</aside>

<!-- Mobile: Bottom Bar -->
<div
	class="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-3 safe-area-pb"
>
	{#if selectedBowlSize}
		<div class="mb-2">
			<div class="flex items-center justify-between text-xs mb-1">
				<span class="text-gray-500">{$_('home.order.capacity')}</span>
				<span class="font-medium {isOverCapacity ? 'text-red-600' : 'text-gray-700'}">
					{totals.weight}g / {selectedBowlSize}g
				</span>
			</div>
			<div class="h-1.5 bg-gray-100 rounded-full overflow-hidden">
				<div
					class="h-full rounded-full transition-all duration-300 {isOverCapacity
						? 'bg-red-500'
						: 'bg-gray-900'}"
					style="width: {Math.min(capacityUsed, 100)}%"
				></div>
			</div>
			{#if isOverCapacity}
				<p class="text-xs text-red-600 mt-0.5">
					{$_('home.order.overCapacity', {
						values: { amount: totals.weight - selectedBowlSize }
					})}
				</p>
			{/if}
		</div>
	{/if}
	<div class="flex items-center justify-between gap-4">
		<div>
			<span class="block text-xs text-gray-500"
				>{$_('home.order.items', { values: { count: selectedList.length } })}</span
			>
			<span class="block text-lg font-bold text-gray-900">{formatPrice(totals.price)} COP</span>
		</div>
		<button
			type="button"
			onclick={onSubmit}
			disabled={!canSubmit || submitting}
			class="flex-1 max-w-[200px] py-3 bg-gray-900 text-white rounded-xl font-semibold hover:bg-gray-800 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
		>
			{submitting ? $_('home.order.placing') : $_('home.order.placeOrder')}
		</button>
	</div>
</div>

<style>
	.safe-area-pb {
		padding-bottom: max(0.75rem, env(safe-area-inset-bottom));
	}
</style>
