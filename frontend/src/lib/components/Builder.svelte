<script lang="ts">
	import { _, locale } from 'svelte-i18n';
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
		bowlSize === 250 ? $_('size.small') : bowlSize === 450 ? $_('size.medium') : $_('size.large')
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

	// Selected ingredients (for the expanded sheet list), in assembly order
	const selectedList = $derived.by(() => {
		const list: { id: number; name: string; quantity: number }[] = [];
		const isEs = $locale?.startsWith('es') ?? true;
		categoryOrder.forEach((cat) => {
			(ingredientsByCategory[cat] ?? []).forEach((ing) => {
				const qty = selectedItems.get(ing.id);
				if (qty !== undefined && qty > 0) {
					list.push({ id: ing.id, name: isEs ? ing.nameEs : ing.nameEn, quantity: qty });
				}
			});
		});
		return list;
	});

	// ──────────────────────────────────────────────
	// Bottom sheet: "Ver detalles" toggle (acts as a modal)
	// ──────────────────────────────────────────────
	let showDetails = $state(false);

	$effect(() => {
		if (showDetails) {
			const prev = document.body.style.overflow;
			document.body.style.overflow = 'hidden';
			return () => {
				document.body.style.overflow = prev;
			};
		}
	});

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape' && showDetails) showDetails = false;
	}

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

<svelte:window onkeydown={handleKeydown} />

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
	<div class="mx-5 mb-5 flex items-center gap-3 rounded-[14px] bg-light-green px-3 py-3">
		<svg
			class="shrink-0 text-dark-green"
			width="20"
			height="20"
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
		<p class="m-0 text-sm font-semibold leading-5 text-dark-green">
			{$_('builder.nutritionNote')}
		</p>
	</div>

	<!-- Category accordions -->
	<div class="flex flex-1 flex-col gap-3 px-5 pb-56">
		{#if loading}
			<div class="flex items-center justify-center py-12 text-sm text-text-muted">
				{$_('common.loading')}
			</div>
		{:else}
			{#each sortedCategories as cat, i (cat)}
				<CategoryAccordion
					label={$_(`category.${cat}`)}
					ingredients={ingredientsByCategory[cat] ?? []}
					{selectedItems}
					{remaining}
					defaultOpen={i === 0}
					onAdd={handleAdd}
					onIncrease={handleIncrease}
					onDecrease={handleDecrease}
					onRemove={handleRemove}
				/>
			{/each}
		{/if}
	</div>

	<!-- Bottom sheet (collapsed + expanded modal) -->
	{#if hasItems}
		<!-- Backdrop when expanded -->
		{#if showDetails}
			<div
				class="fixed inset-0 z-30 bg-black/50"
				role="presentation"
				onclick={() => (showDetails = false)}
				onkeydown={(e) => {
					if (e.key === 'Enter' || e.key === ' ') showDetails = false;
				}}
				tabindex="-1"
			></div>
		{/if}

		<!-- Sheet container -->
		<div
			class="fixed bottom-0 left-0 right-0 flex flex-col gap-3 px-4 pb-6 pt-2"
			class:z-20={!showDetails}
			class:z-40={showDetails}
			role={showDetails ? 'dialog' : undefined}
			aria-modal={showDetails ? 'true' : undefined}
			aria-labelledby={showDetails ? 'bowl-summary-title' : undefined}
		>
			<!-- Black status card (Ver detalles row + optional expanded content) -->
			<div class="flex flex-col gap-3 rounded-[16px] bg-sheet-black py-6">
				<!-- Ver detalles toggle row -->
				<button
					type="button"
					class="flex w-full cursor-pointer items-center justify-between border-none bg-transparent px-4 [-webkit-tap-highlight-color:transparent]"
					onclick={() => (showDetails = !showDetails)}
					aria-expanded={showDetails}
					aria-controls="bowl-summary-content"
				>
					<span class="text-xs text-light-green">
						{showDetails ? $_('builder.closeSheet') : $_('builder.viewDetails')}
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
						class="shrink-0 text-light-green transition-transform duration-200"
						style={showDetails ? 'transform: rotate(180deg)' : ''}
						aria-hidden="true"
					>
						<polyline points="6 9 12 15 18 9" />
					</svg>
				</button>

				<!-- Weight + price row -->
				<div class="flex items-center justify-between px-4 text-sm text-pure-white/70">
					<p class="m-0">
						{$_('builder.weight', { values: { used: totals.weight, total: bowlSize } })}
					</p>
					<p class="m-0 text-right font-bold text-light-green">
						{$_('builder.price', { values: { price: formattedPrice } })}
					</p>
				</div>

				{#if isOverCapacity}
					<p class="m-0 px-4 text-center text-xs font-semibold text-red-400">
						{$_('builder.overCapacity', { values: { amount: totals.weight - bowlSize } })}
					</p>
				{/if}
			</div>

			<!-- Expanded sheet body (macros + selected ingredients) -->
			{#if showDetails}
				<div
					id="bowl-summary-content"
					class="flex flex-col gap-4 rounded-[16px] bg-sheet-black p-4 text-pure-white"
				>
					<p
						id="bowl-summary-title"
						class="m-0 text-xs font-bold uppercase tracking-[0.6px] text-pure-white"
					>
						{$_('builder.macros')}
					</p>
					<div class="grid grid-cols-4 gap-3" role="list">
						{#each [{ label: $_('menu.card.calories'), value: `${totals.calories}` }, { label: $_('menu.card.protein'), value: `${totals.protein}g` }, { label: $_('menu.card.carbs'), value: `${totals.carbs}g` }, { label: $_('menu.card.fat'), value: `${totals.fat}g` }] as col (col.label)}
							<div class="flex flex-col items-center gap-0.5" role="listitem">
								<span class="text-[10px] font-medium uppercase tracking-[0.6px] text-pure-white">
									{col.label}
								</span>
								<span class="text-base font-semibold text-pure-white">{col.value}</span>
							</div>
						{/each}
					</div>

					<p class="m-0 mt-2 text-xs font-bold uppercase tracking-[0.6px] text-pure-white">
						{$_('builder.selectedIngredients')}
					</p>
					<div class="flex flex-col gap-2" role="list">
						{#each selectedList as item (item.id)}
							<div
								class="flex items-center justify-between rounded-[14px] bg-sheet-card px-3 py-3 text-xs text-pure-white"
								role="listitem"
							>
								<span>{item.name}</span>
								<span class="font-bold">{item.quantity}g</span>
							</div>
						{/each}
					</div>
				</div>
			{/if}

			<!-- CTA pill -->
			<button
				type="button"
				class="flex w-full cursor-pointer items-center justify-between gap-2 rounded-full border-none bg-dark-green px-16 py-4 text-base font-semibold tracking-[0.8px] text-light-green transition-all duration-200 hover:opacity-95 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50 [-webkit-tap-highlight-color:transparent]"
				disabled={!hasItems || isOverCapacity}
				onclick={onAddToCart}
			>
				<span class="flex-1 text-center">
					{$_('builder.addToCart', { values: { price: formattedPrice } })}
				</span>
				<svg
					width="20"
					height="20"
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
	{/if}
</div>
