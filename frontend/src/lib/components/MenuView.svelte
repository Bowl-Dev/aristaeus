<script lang="ts">
	import type { Menu } from '$lib/types';
	import { _, locale } from 'svelte-i18n';

	const BOWL_BASE_PRICE: Record<number, number> = { 250: 1200, 450: 1300, 600: 1400 };

	let {
		menus,
		onSelect,
		onBack
	}: {
		menus: Menu[];
		onSelect: (menu: Menu, scaledItems: { ingredientId: number; quantityGrams: number }[]) => void;
		onBack: () => void;
	} = $props();

	const menuCardsData = $derived.by(() => {
		return menus.map((menu) => {
			let calories = 0;
			let protein = 0;
			let price = BOWL_BASE_PRICE[menu.bowlSize] ?? 1300;

			menu.ingredients.forEach((mi) => {
				const mult = mi.quantityGrams / 100;
				calories += mi.caloriesPer100g * mult;
				protein += mi.proteinGPer100g * mult;
				price += mi.pricePerG * mi.quantityGrams;
			});

			return {
				menu,
				calories: Math.round(calories),
				protein: Math.round(protein),
				price: Math.round(price / 100) * 100
			};
		});
	});

	function formatPrice(price: number): string {
		return `$${price.toLocaleString('es-CO')}`;
	}

	function handleOrder(menu: Menu) {
		onSelect(
			menu,
			menu.ingredients.map((mi) => ({
				ingredientId: mi.ingredientId,
				quantityGrams: mi.quantityGrams
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

		<!-- Menu Grid -->
		<div class="grid grid-cols-1 md:grid-cols-2 gap-5">
			{#each menuCardsData as { menu, calories, protein, price } (menu.id)}
				<div class="bg-white rounded-2xl border border-gray-200 p-6 flex flex-col">
					<div class="flex-1">
						<h2 class="text-xl font-semibold text-gray-900 mb-1">
							{$locale === 'es' ? menu.nameEs : menu.nameEn}
						</h2>
						<p class="text-gray-500 text-sm mb-4">
							{$locale === 'es' ? menu.descriptionEs : menu.descriptionEn}
						</p>

						<!-- Ingredient chips -->
						<div class="flex flex-wrap gap-1.5 mb-5">
							{#each menu.ingredients as mi (mi.ingredientId)}
								<span
									class="inline-flex items-center gap-1 bg-gray-100 text-gray-700 text-xs px-2.5 py-1 rounded-full"
								>
									{$_('ingredients.' + mi.ingredientName, { default: mi.ingredientName })}
									<span class="text-gray-400">{mi.quantityGrams}g</span>
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
							onclick={() => handleOrder(menu)}
						>
							{$_('home.menu.orderButton')}
						</button>
					</div>
				</div>
			{/each}
		</div>
	</div>
</div>
