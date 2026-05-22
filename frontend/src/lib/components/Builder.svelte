<script lang="ts">
	import { _ } from 'svelte-i18n';
	import { SvelteMap } from 'svelte/reactivity';
	import type { Ingredient, BowlSize } from '$lib/types';
	import AppHeader from './organisms/AppHeader.svelte';
	import CategoryAccordion from './molecules/CategoryAccordion.svelte';

	let {
		ingredients,
		loading,
		bowlSize,
		selectedItems,
		cartCount,
		onBack,
		onAddToCart
	}: {
		ingredients: Ingredient[];
		loading: boolean;
		bowlSize: BowlSize;
		selectedItems: SvelteMap<number, number>;
		cartCount?: number;
		onBack: () => void;
		onAddToCart: () => void;
	} = $props();

	// ──────────────────────────────────────────────
	// Derived: category grouping
	// ──────────────────────────────────────────────
	const categoryOrder = ['base', 'protein', 'vegetable', 'topping', 'dressing'];

	const categoryLabels: Record<string, { es: string; en: string }> = {
		base: { es: 'Base', en: 'Base' },
		protein: { es: 'Proteína', en: 'Protein' },
		vegetable: { es: 'Vegetales', en: 'Vegetables' },
		topping: { es: 'Toppings', en: 'Toppings' },
		dressing: { es: 'Aderezo', en: 'Dressing' }
	};

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

	// ──────────────────────────────────────────────
	// Bowl size badge label
	// ──────────────────────────────────────────────
	const sizeBadgeLabel = $derived(
		bowlSize === 250
			? $_('size.small')
			: bowlSize === 450
				? $_('size.medium')
				: $_('size.large')
	);

	// ──────────────────────────────────────────────
	// Totals
	// ──────────────────────────────────────────────
	const totals = $derived.by(() => {
		let weight = 0;
		let price = 0;
		let calories = 0;
		let protein = 0;
		let carbs = 0;
		let fat = 0;

		selectedItems.forEach((qty, id) => {
			const ing = ingredients.find((i) => i.id === id);
			if (ing) {
				const mult = qty / 100;
				calories += ing.caloriesPer100g * mult;
				protein += ing.proteinGPer100g * mult;
				carbs += ing.carbsGPer100g * mult;
				fat += ing.fatGPer100g * mult;
				weight += qty;
				price += ing.pricePerG * qty;
			}
		});

		return {
			weight,
			price,
			calories: Math.round(calories),
			protein: Math.round(protein),
			carbs: Math.round(carbs),
			fat: Math.round(fat)
		};
	});

	const remaining = $derived(bowlSize - totals.weight);
	const isOverCapacity = $derived(totals.weight > bowlSize);
	const hasItems = $derived(selectedItems.size > 0);

	const formattedPrice = $derived(
		new Intl.NumberFormat('es-CO', {
			style: 'currency',
			currency: 'COP',
			minimumFractionDigits: 0,
			maximumFractionDigits: 0
		}).format(totals.price)
	);

	// ──────────────────────────────────────────────
	// Bottom sheet: "Ver detalles" toggle
	// ──────────────────────────────────────────────
	let showDetails = $state(false);

	// ──────────────────────────────────────────────
	// Ingredient actions
	// ──────────────────────────────────────────────
	function getIncrement(id: number): number {
		const ing = ingredients.find((i) => i.id === id);
		return ing?.category === 'dressing' || ing?.category === 'topping' ? 5 : 10;
	}

	function getInitialQuantity(id: number): number {
		const ing = ingredients.find((i) => i.id === id);
		return ing?.category === 'dressing' || ing?.category === 'topping' ? 5 : 50;
	}

	function handleAdd(id: number) {
		const step = getIncrement(id);
		if (remaining < step) return;
		const initial = getInitialQuantity(id);
		// Clamp to available capacity
		selectedItems.set(id, Math.min(initial, remaining));
	}

	function handleIncrease(id: number) {
		const step = getIncrement(id);
		if (remaining < step) return;
		const current = selectedItems.get(id) ?? 0;
		selectedItems.set(id, current + step);
	}

	function handleDecrease(id: number) {
		const step = getIncrement(id);
		const current = selectedItems.get(id) ?? 0;
		if (current <= step) {
			selectedItems.delete(id);
		} else {
			selectedItems.set(id, current - step);
		}
	}

	function handleRemove(id: number) {
		selectedItems.delete(id);
	}
</script>

<div class="flex min-h-svh flex-col bg-white-green">
	<!-- Sticky header -->
	<AppHeader {onBack} {cartCount} />

	<!-- Screen heading + size badge -->
	<div class="flex items-start justify-between gap-3 px-5 pb-4 pt-6">
		<div class="flex flex-col gap-1">
			<p class="m-0 text-base leading-snug text-text-muted">
				{$_('builder.subtitle')}
			</p>
		</div>
		<span
			class="shrink-0 rounded-full bg-light-green px-3 py-1 text-xs font-bold uppercase tracking-[0.7px] text-dark-green"
		>
			{sizeBadgeLabel}
		</span>
	</div>

	<!-- Nutritional info disclaimer -->
	<div class="mx-5 mb-5 flex items-start gap-2 rounded-2xl bg-light-green/30 px-4 py-3">
		<svg
			class="mt-0.5 shrink-0 text-dark-green"
			width="16"
			height="16"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="2"
			stroke-linecap="round"
			stroke-linejoin="round"
			aria-hidden="true"
		>
			<circle cx="12" cy="12" r="10" />
			<line x1="12" y1="8" x2="12" y2="12" />
			<line x1="12" y1="16" x2="12.01" y2="16" />
		</svg>
		<p class="m-0 text-xs leading-relaxed text-dark-green">
			{$_('builder.nutritionNote')}
		</p>
	</div>

	<!-- Category accordions -->
	<div class="flex flex-1 flex-col gap-3 px-5 pb-40">
		{#if loading}
			<div class="flex items-center justify-center py-12 text-sm text-text-muted">
				{$_('common.loading')}
			</div>
		{:else}
			{#each sortedCategories as cat (cat)}
				<CategoryAccordion
					label={categoryLabels[cat]?.es ?? cat}
					ingredients={ingredientsByCategory[cat] ?? []}
					{selectedItems}
					{remaining}
					onAdd={handleAdd}
					onIncrease={handleIncrease}
					onDecrease={handleDecrease}
					onRemove={handleRemove}
				/>
			{/each}
		{/if}
	</div>

	<!-- Sticky bottom bar -->
	{#if hasItems || !loading}
		<div
			class="fixed bottom-0 left-0 right-0 z-20 flex flex-col rounded-t-[24px] bg-text-black shadow-[0_-4px_32px_rgba(0,0,0,0.18)]"
		>
			<!-- "Ver detalles" toggle row -->
			<button
				class="flex cursor-pointer items-center justify-between border-none bg-transparent px-5 py-3 text-pure-white [-webkit-tap-highlight-color:transparent]"
				onclick={() => (showDetails = !showDetails)}
				aria-expanded={showDetails}
			>
				<span class="text-xs font-semibold text-pure-white/70">
					{$_('builder.viewDetails')}
				</span>
				<div class="flex items-center gap-4">
					<span class="text-sm text-pure-white/70">
						{$_('builder.weight', { values: { used: totals.weight, total: bowlSize } })}
					</span>
					<span class="text-sm font-bold text-pure-white">
						{$_('builder.price', { values: { price: formattedPrice } })}
					</span>
					<svg
						width="16"
						height="16"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2.5"
						stroke-linecap="round"
						stroke-linejoin="round"
						class="shrink-0 text-pure-white/70 transition-transform duration-200"
						style={showDetails ? 'transform: rotate(180deg)' : ''}
						aria-hidden="true"
					>
						<polyline points="6 9 12 15 18 9" />
					</svg>
				</div>
			</button>

			<!-- Expanded nutritional details -->
			{#if showDetails}
				<div class="grid grid-cols-4 gap-2 px-5 pb-3">
					{#each [
						{ label: $_('menu.card.calories'), value: `${totals.calories}` },
						{ label: $_('menu.card.protein'), value: `${totals.protein}g` },
						{ label: $_('menu.card.carbs'), value: `${totals.carbs}g` },
						{ label: $_('menu.card.fat'), value: `${totals.fat}g` }
					] as col (col.label)}
						<div class="flex flex-col items-center rounded-xl bg-pure-white/10 py-2">
							<span class="text-[9px] font-medium uppercase tracking-[0.6px] text-pure-white/60">
								{col.label}
							</span>
							<span class="text-sm font-bold text-pure-white">{col.value}</span>
						</div>
					{/each}
				</div>

				{#if isOverCapacity}
					<p class="mx-5 mb-3 text-center text-xs font-semibold text-red-400">
						{$_('builder.overCapacity', { values: { amount: totals.weight - bowlSize } })}
					</p>
				{:else}
					<p class="mx-5 mb-3 text-center text-xs text-pure-white/50">
						{$_('builder.remaining', { values: { amount: remaining } })}
					</p>
				{/if}
			{/if}

			<!-- CTA button -->
			<div class="px-5 pb-8 pt-1">
				<button
					class="flex w-full cursor-pointer items-center justify-center gap-2 rounded-full border-none bg-light-green px-6 py-4 text-sm font-bold uppercase tracking-[0.08em] text-dark-green transition-all duration-200 hover:opacity-95 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50"
					disabled={!hasItems || isOverCapacity}
					onclick={onAddToCart}
				>
					{$_('builder.addToCart', { values: { price: formattedPrice } })}
					<svg
						width="18"
						height="18"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
						aria-hidden="true"
					>
						<circle cx="9" cy="21" r="1" />
						<circle cx="20" cy="21" r="1" />
						<path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
					</svg>
				</button>
			</div>
		</div>
	{/if}
</div>
