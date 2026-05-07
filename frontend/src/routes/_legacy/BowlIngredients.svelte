<script lang="ts">
	import {
		type Ingredient,
		type BowlSize,
		BOWL_SIZES,
		BOWL_SIZE_PRICES,
		DRESSING_CONTAINER_GRAMS
	} from '$lib/types';
	import type { SvelteMap, SvelteSet } from 'svelte/reactivity';
	import { slide } from 'svelte/transition';
	import { _ } from 'svelte-i18n';

	// Props
	let {
		ingredients,
		loading,
		error,
		selectedBowlSize = $bindable(),
		isCutlery = $bindable(),
		selectedItems,
		expandedCategories,
		onLoadIngredients,
		onAddIngredient,
		onRemoveIngredient,
		onSetQuantity,
		onClearAll,
		onGenerateRandom,
		onToggleCategory,
		getInitialQuantity
	}: {
		ingredients: Ingredient[];
		loading: boolean;
		error: string | null;
		selectedBowlSize: BowlSize | null;
		isCutlery: boolean;
		selectedItems: SvelteMap<number, number>;
		expandedCategories: SvelteSet<string>;
		onLoadIngredients: () => void;
		onAddIngredient: (id: number) => void;
		onRemoveIngredient: (id: number) => void;
		onSetQuantity: (id: number, qty: number) => void;
		onClearAll: () => void;
		onGenerateRandom: () => void;
		onToggleCategory: (cat: string) => void;
		getInitialQuantity: (category: string) => number;
	} = $props();

	// Category order
	const categoryOrder = ['base', 'protein', 'vegetable', 'topping', 'dressing'];

	// Derived states
	const ingredientsByCategory = $derived.by(() => {
		const grouped: Record<string, Ingredient[]> = {};
		ingredients.forEach((ing) => {
			if (!grouped[ing.category]) grouped[ing.category] = [];
			grouped[ing.category].push(ing);
		});
		return grouped;
	});

	const sortedCategories = $derived(
		categoryOrder.filter((cat) => ingredientsByCategory[cat]?.length > 0)
	);

	// Helper functions
	function getCategoryLabel(cat: string): string {
		return $_(`home.categories.${cat}`) || cat;
	}

	function getIngredientName(name: string): string {
		return $_(`ingredients.${name}`) || name;
	}

	function formatPrice(cop: number): string {
		return `$${Math.round(cop / 100) * 100}`;
	}

	function formatPricePerGram(pricePerG: number): string {
		return `$${Math.round(pricePerG)}/g`;
	}

	function formatQuantityDisplay(category: string, grams: number): string {
		if (category === 'dressing') {
			const containers = grams / DRESSING_CONTAINER_GRAMS;
			if (containers === 1) {
				return $_('home.ingredient.container', { values: { count: 1 } });
			}
			return $_('home.ingredient.containers', { values: { count: containers } });
		}
		return `${grams}g`;
	}
</script>

<!-- Bowl Size -->
<section class="mb-8">
	<span class="block text-sm font-medium text-gray-700 mb-3">{$_('home.bowlSize.label')}</span>
	<div class="grid grid-cols-3 gap-3" role="radiogroup" aria-label="Bowl size selection">
		{#each BOWL_SIZES as size, i (size)}
			<button
				type="button"
				onclick={() => (selectedBowlSize = size)}
				class="relative py-4 px-3 rounded-xl border-2 transition-all {selectedBowlSize === size
					? 'border-gray-900 bg-gray-900 text-white'
					: 'border-gray-200 bg-white text-gray-900 hover:border-gray-300'}"
			>
				<span class="block text-lg font-semibold">{size}g</span>
				<span
					class="block text-xs mt-0.5 {selectedBowlSize === size
						? 'text-gray-300'
						: 'text-gray-400'}"
				>
					{formatPrice(BOWL_SIZE_PRICES[i])}
				</span>
			</button>
		{/each}
	</div>
</section>

<!-- Quick Actions -->
<div class="flex gap-3 mb-8">
	<button
		type="button"
		onclick={onGenerateRandom}
		disabled={loading}
		class="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-colors disabled:opacity-50"
	>
		<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
			<path
				stroke-linecap="round"
				stroke-linejoin="round"
				stroke-width="2"
				d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
			/>
		</svg>
		{$_('home.actions.surpriseMe')}
	</button>
	<button
		type="button"
		onclick={onClearAll}
		disabled={selectedItems.size === 0}
		class="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-colors disabled:opacity-50"
	>
		<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
			<path
				stroke-linecap="round"
				stroke-linejoin="round"
				stroke-width="2"
				d="M6 18L18 6M6 6l12 12"
			/>
		</svg>
		{$_('home.actions.clear')}
	</button>
</div>

<!-- Ingredients Accordion -->
{#if loading}
	<div class="text-center py-16">
		<div
			class="w-8 h-8 border-2 border-gray-900 border-t-transparent rounded-full animate-spin mx-auto"
		></div>
		<p class="text-gray-500 mt-4 text-sm">{$_('home.loading.ingredients')}</p>
	</div>
{:else if error}
	<div class="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
		<p class="text-red-600 text-sm">{error}</p>
		<button
			onclick={onLoadIngredients}
			class="mt-2 text-sm font-medium text-red-700 hover:underline"
		>
			{$_('common.tryAgain')}
		</button>
	</div>
{:else}
	<section class="space-y-3">
		{#each sortedCategories as category (category)}
			{@const isExpanded = expandedCategories.has(category)}
			{@const categoryItems = ingredientsByCategory[category]}
			{@const selectedInCategory = categoryItems.filter((i) => selectedItems.has(i.id)).length}

			<div class="bg-white rounded-xl border border-gray-200 overflow-hidden">
				<!-- Category Header -->
				<button
					type="button"
					onclick={() => onToggleCategory(category)}
					class="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-gray-50 transition-colors"
				>
					<div class="flex flex-col">
						<div class="flex items-center gap-3">
							<span class="text-base font-semibold text-gray-900">{getCategoryLabel(category)}</span
							>
							{#if selectedInCategory > 0}
								<span class="px-2 py-0.5 bg-gray-900 text-white text-xs font-medium rounded-full">
									{selectedInCategory}
								</span>
							{/if}
						</div>
						{#if category === 'dressing'}
							<span class="text-xs text-gray-500 mt-0.5">{$_('home.categories.dressingNote')}</span>
						{/if}
					</div>
					<svg
						class="w-5 h-5 text-gray-400 transition-transform {isExpanded ? 'rotate-180' : ''}"
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M19 9l-7 7-7-7"
						/>
					</svg>
				</button>

				<!-- Ingredients List -->
				{#if isExpanded}
					<div class="border-t border-gray-100" transition:slide={{ duration: 200 }}>
						{#each categoryItems as ingredient (ingredient.id)}
							{@const qty = selectedItems.get(ingredient.id) || 0}
							{@const isSelected = qty > 0}

							<div
								class="flex items-center justify-between px-5 py-3 border-b border-gray-50 last:border-b-0 {isSelected
									? 'bg-gray-50'
									: ''}"
							>
								<div class="flex-1 min-w-0">
									<div class="flex items-center gap-2">
										<span class="font-medium text-gray-900 truncate">
											{getIngredientName(ingredient.name)}
										</span>
									</div>
									<div class="flex items-center gap-3 mt-0.5 text-xs text-gray-500">
										<span>{ingredient.caloriesPer100g} {$_('home.ingredient.cal')}</span>
										<span class="text-gray-300">|</span>
										<span>{ingredient.proteinGPer100g}g {$_('home.ingredient.protein')}</span>
										<span class="text-gray-300">|</span>
										<span>{formatPricePerGram(ingredient.pricePerG)}</span>
									</div>
								</div>

								<!-- Quantity Controls -->
								<div class="flex items-center gap-2 ml-4">
									{#if isSelected}
										<button
											type="button"
											onclick={() => onRemoveIngredient(ingredient.id)}
											aria-label={$_('home.ingredient.decrease', {
												values: { name: getIngredientName(ingredient.name) }
											})}
											class="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-200 text-gray-700 hover:bg-gray-300 transition-colors"
										>
											<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
												<path
													stroke-linecap="round"
													stroke-linejoin="round"
													stroke-width="2"
													d="M20 12H4"
												/>
											</svg>
										</button>
										<span class="w-16 text-center text-sm font-semibold text-gray-900"
											>{formatQuantityDisplay(ingredient.category, qty)}</span
										>
										<button
											type="button"
											onclick={() => onAddIngredient(ingredient.id)}
											aria-label={$_('home.ingredient.increase', {
												values: { name: getIngredientName(ingredient.name) }
											})}
											class="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-900 text-white hover:bg-gray-800 transition-colors"
										>
											<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
												<path
													stroke-linecap="round"
													stroke-linejoin="round"
													stroke-width="2"
													d="M12 4v16m8-8H4"
												/>
											</svg>
										</button>
									{:else}
										<button
											type="button"
											onclick={() =>
												onSetQuantity(ingredient.id, getInitialQuantity(ingredient.category))}
											class="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
										>
											{$_('home.actions.add')}
										</button>
									{/if}
								</div>
							</div>
						{/each}
					</div>
				{/if}
			</div>
		{/each}
	</section>
{/if}

<!-- Cutlery Option -->
<section class="mt-8 mb-24 lg:mb-8">
	<label class="flex items-center gap-3 cursor-pointer">
		<input
			type="checkbox"
			bind:checked={isCutlery}
			class="w-5 h-5 rounded border-gray-300 text-gray-900 focus:ring-gray-900"
		/>
		<span class="text-sm text-gray-700">{$_('home.cutlery.label')}</span>
	</label>
</section>
