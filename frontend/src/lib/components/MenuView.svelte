<script lang="ts">
	import type { Ingredient, BowlSize } from '$lib/types';
	import { BOWL_SIZES } from '$lib/types';
	import type { MenuItem } from '$lib/menuItems';
	import { MENU_ITEMS } from '$lib/menuItems';
	import { _ } from 'svelte-i18n';

	let {
		ingredients,
		onSelect,
		onBack
	}: {
		ingredients: Ingredient[];
		onSelect: (
			item: MenuItem,
			size: BowlSize,
			scaledItems: { ingredientName: string; quantityGrams: number }[]
		) => void;
		onBack: () => void;
	} = $props();

	let selectedSize = $state<BowlSize>(450);

	const BOWL_BASE_PRICE: Record<number, number> = { 250: 1200, 450: 1300, 600: 1400 };

	const SIZE_LABELS: Record<BowlSize, string> = {
		250: 'home.menu.size.small',
		450: 'home.menu.size.medium',
		600: 'home.menu.size.large'
	};

	function scaleQty(qty: number, factor: number): number {
		return Math.max(5, Math.round((qty * factor) / 5) * 5);
	}

	const menuCardsData = $derived.by(() => {
		return MENU_ITEMS.map((item) => {
			const scaleFactor = selectedSize / item.bowlSize;
			let calories = 0;
			let protein = 0;
			let price = BOWL_BASE_PRICE[selectedSize] ?? 1300;

			const scaledItems = item.items.flatMap(({ ingredientName, quantityGrams }) => {
				const ingredient = ingredients.find((i) => i.name === ingredientName);
				if (!ingredient) return [];
				const scaledQty = scaleQty(quantityGrams, scaleFactor);
				const mult = scaledQty / 100;
				calories += ingredient.caloriesPer100g * mult;
				protein += ingredient.proteinGPer100g * mult;
				price += ingredient.pricePerG * scaledQty;
				return [{ ingredient, quantityGrams: scaledQty }];
			});

			return {
				item,
				scaledItems,
				calories: Math.round(calories),
				protein: Math.round(protein),
				price: Math.round(price)
			};
		});
	});

	function formatPrice(price: number): string {
		return `$${price.toLocaleString('es-CO')}`;
	}

	function handleOrder(
		item: MenuItem,
		scaledItems: { ingredient: Ingredient; quantityGrams: number }[]
	) {
		onSelect(
			item,
			selectedSize,
			scaledItems.map(({ ingredient, quantityGrams }) => ({
				ingredientName: ingredient.name,
				quantityGrams
			}))
		);
	}
</script>

<div class="min-h-screen bg-gray-50 font-sans">
	<div class="max-w-3xl mx-auto px-6 py-8">
		<!-- Header -->
		<div class="mb-6">
			<button
				class="flex items-center gap-1.5 text-gray-500 hover:text-gray-900 transition-colors text-sm font-medium mb-5"
				onclick={onBack}
			>
				<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M15 19l-7-7 7-7"
					/>
				</svg>
				{$_('home.menu.back')}
			</button>
			<h1 class="text-3xl font-bold text-gray-900 tracking-tight">{$_('home.menu.title')}</h1>
			<p class="text-gray-500 mt-1">{$_('home.menu.customizeNote')}</p>
		</div>

		<!-- Size Picker -->
		<div class="mb-6">
			<p class="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">
				{$_('home.menu.size.title')}
			</p>
			<div class="inline-flex gap-2 bg-white border border-gray-200 rounded-2xl p-1.5">
				{#each BOWL_SIZES as size (size)}
					<button
						class="px-5 py-2 rounded-xl text-sm font-medium transition-all duration-150
							{selectedSize === size
							? 'bg-gray-900 text-white shadow-sm'
							: 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'}"
						onclick={() => (selectedSize = size)}
					>
						{$_(SIZE_LABELS[size])}
					</button>
				{/each}
			</div>
		</div>

		<!-- Menu Grid -->
		<div class="grid grid-cols-1 md:grid-cols-2 gap-5">
			{#each menuCardsData as { item, scaledItems, calories, protein, price } (item.id)}
				<div class="bg-white rounded-2xl border border-gray-200 p-6 flex flex-col">
					<div class="flex-1">
						<h2 class="text-xl font-semibold text-gray-900 mb-1">{$_(item.titleKey)}</h2>
						<p class="text-gray-500 text-sm mb-4">{$_(item.descriptionKey)}</p>

						<!-- Ingredient chips -->
						<div class="flex flex-wrap gap-1.5 mb-5">
							{#each scaledItems as { ingredient, quantityGrams } (ingredient.id)}
								<span
									class="inline-flex items-center gap-1 bg-gray-100 text-gray-700 text-xs px-2.5 py-1 rounded-full"
								>
									{$_('ingredients.' + ingredient.name, { default: ingredient.name })}
									<span class="text-gray-400">{quantityGrams}g</span>
								</span>
							{/each}
						</div>

						<!-- Nutrition row -->
						<div class="flex gap-5 text-sm text-gray-500 mb-2">
							<span>
								🔥 <strong class="text-gray-900">{calories}</strong>
								{$_('home.order.calories').toLowerCase()}
							</span>
							<span>
								💪 <strong class="text-gray-900">{protein}g</strong>
								{$_('home.order.protein').toLowerCase()}
							</span>
						</div>
					</div>

					<!-- Price + CTA -->
					<div class="flex items-center justify-between pt-4 mt-2 border-t border-gray-100">
						<span class="text-xl font-bold text-gray-900">{formatPrice(price)}</span>
						<button
							class="bg-gray-900 text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-800 transition-colors"
							onclick={() => handleOrder(item, scaledItems)}
						>
							{$_('home.menu.orderButton')}
						</button>
					</div>
				</div>
			{/each}
		</div>
	</div>
</div>
