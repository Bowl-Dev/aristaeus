<script lang="ts">
	import { type Ingredient, type BowlSize, BOWL_SIZES, BOWL_SIZE_PRICES } from '$lib/types';
	import { SvelteMap, SvelteSet } from 'svelte/reactivity';
	import { getIngredients, createOrder, ApiError } from '$lib/api/client';
	import { slide, fade } from 'svelte/transition';
	import { _ } from 'svelte-i18n';

	// State
	let ingredients = $state<Ingredient[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let submitting = $state(false);
	let orderSuccess = $state<{ orderId: number } | null>(null);

	// Form state
	let customerName = $state('');
	let selectedBowlSize = $state<BowlSize | null>(null);
	let selectedItems = new SvelteMap<number, number>();
	let expandedCategories = new SvelteSet<string>(['base']);
	let isCutlery = $state(false);

	// Load ingredients
	async function loadIngredients() {
		loading = true;
		error = null;
		try {
			ingredients = await getIngredients();
		} catch (e) {
			error = e instanceof ApiError ? e.message : 'Failed to load ingredients';
		} finally {
			loading = false;
		}
	}

	$effect(() => {
		loadIngredients();
	});

	// Derived state
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

	const selectedList = $derived.by(() => {
		const list: { ingredient: Ingredient; quantity: number }[] = [];
		selectedItems.forEach((qty, id) => {
			const ing = ingredients.find((i) => i.id === id);
			if (ing) list.push({ ingredient: ing, quantity: qty });
		});
		return list;
	});

	const totals = $derived.by(() => {
		let calories = 0,
			protein = 0,
			weight = 0,
			price = 0;

		// Bowl base price
		if (selectedBowlSize === 250) price = BOWL_SIZE_PRICES[0];
		else if (selectedBowlSize === 450) price = BOWL_SIZE_PRICES[1];
		else if (selectedBowlSize === 600) price = BOWL_SIZE_PRICES[2];

		if (isCutlery) price += 300;

		selectedItems.forEach((qty, id) => {
			const ing = ingredients.find((i) => i.id === id);
			if (ing) {
				const mult = qty / 100;
				calories += ing.caloriesPer100g * mult;
				protein += ing.proteinGPer100g * mult;
				weight += qty;
				price += ing.pricePerG * qty;
			}
		});

		return { calories, protein, weight, price };
	});

	const capacityUsed = $derived(selectedBowlSize ? (totals.weight / selectedBowlSize) * 100 : 0);
	const isOverCapacity = $derived(selectedBowlSize ? totals.weight > selectedBowlSize : false);

	const canSubmit = $derived(
		customerName.trim().length > 0 &&
			selectedBowlSize !== null &&
			selectedItems.size > 0 &&
			!isOverCapacity
	);

	// Actions
	function toggleCategory(cat: string) {
		if (expandedCategories.has(cat)) {
			expandedCategories.delete(cat);
		} else {
			expandedCategories.add(cat);
		}
	}

	function addIngredient(id: number) {
		const current = selectedItems.get(id) || 0;
		selectedItems.set(id, current + 10);
	}

	function removeIngredient(id: number) {
		const current = selectedItems.get(id) || 0;
		if (current <= 10) {
			selectedItems.delete(id);
		} else {
			selectedItems.set(id, current - 10);
		}
	}

	function setQuantity(id: number, qty: number) {
		if (qty <= 0) {
			selectedItems.delete(id);
		} else {
			selectedItems.set(id, qty);
		}
	}

	function clearAll() {
		selectedItems.clear();
		selectedBowlSize = null;
		isCutlery = false;
	}

	function generateRandom() {
		const size: BowlSize = selectedBowlSize ?? 450;
		selectedBowlSize = size;

		const portions: Record<string, number> =
			size === 250
				? { base: 80, protein: 60, vegetable: 40, topping: 20, dressing: 25 }
				: size === 450
					? { base: 140, protein: 100, vegetable: 50, topping: 30, dressing: 25 }
					: { base: 180, protein: 120, vegetable: 70, topping: 40, dressing: 50 };

		// Clear existing selections first
		selectedItems.clear();

		// Add random ingredients
		sortedCategories.forEach((cat) => {
			const catIngredients = ingredientsByCategory[cat];
			if (catIngredients?.length) {
				const pick = catIngredients[Math.floor(Math.random() * catIngredients.length)];
				selectedItems.set(pick.id, portions[cat] || 50);
			}
		});
	}

	async function submitOrder() {
		if (!canSubmit || !selectedBowlSize) return;

		submitting = true;
		try {
			const items = Array.from(selectedItems.entries()).map(([ingredientId, quantityGrams]) => ({
				ingredientId,
				quantityGrams
			}));

			const response = await createOrder({
				customerName,
				bowlSize: selectedBowlSize,
				items
			});

			orderSuccess = { orderId: response.orderId };
			customerName = '';
			selectedBowlSize = null;
			selectedItems.clear();
			isCutlery = false;
		} catch (e) {
			alert(e instanceof ApiError ? e.message : 'Failed to submit order');
		} finally {
			submitting = false;
		}
	}

	function getCategoryLabel(cat: string): string {
		return $_(`home.categories.${cat}`) || cat;
	}

	function formatPrice(cop: number): string {
		return `$${Math.round(cop / 100) * 100}`;
	}
</script>

<svelte:head>
	<link rel="preconnect" href="https://fonts.googleapis.com" />
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
	<link
		href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap"
		rel="stylesheet"
	/>
</svelte:head>

<!-- Success Modal -->
{#if orderSuccess}
	<div
		class="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
		transition:fade={{ duration: 150 }}
	>
		<div class="bg-white rounded-2xl shadow-xl max-w-sm w-full p-8 text-center">
			<div
				class="w-14 h-14 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4"
			>
				<svg class="w-7 h-7 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M5 13l4 4L19 7"
					/>
				</svg>
			</div>
			<h2 class="text-xl font-semibold text-gray-900 mb-1">{$_('home.success.title')}</h2>
			<p class="text-gray-500 mb-6">
				{$_('home.success.message', { values: { id: orderSuccess.orderId } })}
			</p>
			<button
				class="w-full py-3 bg-gray-900 text-white rounded-xl font-medium hover:bg-gray-800 transition-colors"
				onclick={() => (orderSuccess = null)}
			>
				{$_('home.success.newOrder')}
			</button>
		</div>
	</div>
{/if}

<div class="min-h-screen bg-gray-50 font-sans">
	<div class="flex min-h-screen">
		<!-- Left: Ingredient Selection -->
		<main class="flex-1 lg:mr-[420px]">
			<div class="max-w-2xl mx-auto px-6 py-8">
				<!-- Header -->
				<header class="mb-8">
					<h1 class="text-3xl font-bold text-gray-900 tracking-tight">{$_('home.title')}</h1>
					<p class="text-gray-500 mt-1">{$_('home.subtitle')}</p>
				</header>

				<!-- Customer Name -->
				<section class="mb-8">
					<label for="customer-name" class="block text-sm font-medium text-gray-700 mb-2"
						>{$_('home.customerName.label')}</label
					>
					<input
						id="customer-name"
						type="text"
						bind:value={customerName}
						placeholder={$_('home.customerName.placeholder')}
						class="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-shadow"
					/>
				</section>

				<!-- Bowl Size -->
				<section class="mb-8">
					<span class="block text-sm font-medium text-gray-700 mb-3"
						>{$_('home.bowlSize.label')}</span
					>
					<div class="grid grid-cols-3 gap-3" role="radiogroup" aria-label="Bowl size selection">
						{#each BOWL_SIZES as size, i (size)}
							<button
								type="button"
								onclick={() => (selectedBowlSize = size)}
								class="relative py-4 px-3 rounded-xl border-2 transition-all {selectedBowlSize ===
								size
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
						onclick={generateRandom}
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
						onclick={clearAll}
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
							onclick={loadIngredients}
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
							{@const selectedInCategory = categoryItems.filter((i) =>
								selectedItems.has(i.id)
							).length}

							<div class="bg-white rounded-xl border border-gray-200 overflow-hidden">
								<!-- Category Header -->
								<button
									type="button"
									onclick={() => toggleCategory(category)}
									class="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-gray-50 transition-colors"
								>
									<div class="flex items-center gap-3">
										<span class="text-base font-semibold text-gray-900"
											>{getCategoryLabel(category)}</span
										>
										{#if selectedInCategory > 0}
											<span
												class="px-2 py-0.5 bg-gray-900 text-white text-xs font-medium rounded-full"
											>
												{selectedInCategory}
											</span>
										{/if}
									</div>
									<svg
										class="w-5 h-5 text-gray-400 transition-transform {isExpanded
											? 'rotate-180'
											: ''}"
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
															{ingredient.name}
														</span>
													</div>
													<div class="flex items-center gap-3 mt-0.5 text-xs text-gray-500">
														<span>{ingredient.caloriesPer100g} {$_('home.ingredient.cal')}</span>
														<span class="text-gray-300">|</span>
														<span
															>{ingredient.proteinGPer100g}g {$_('home.ingredient.protein')}</span
														>
													</div>
												</div>

												<!-- Quantity Controls -->
												<div class="flex items-center gap-2 ml-4">
													{#if isSelected}
														<button
															type="button"
															onclick={() => removeIngredient(ingredient.id)}
															aria-label={$_('home.ingredient.decrease', {
																values: { name: ingredient.name }
															})}
															class="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-200 text-gray-700 hover:bg-gray-300 transition-colors"
														>
															<svg
																class="w-4 h-4"
																fill="none"
																stroke="currentColor"
																viewBox="0 0 24 24"
															>
																<path
																	stroke-linecap="round"
																	stroke-linejoin="round"
																	stroke-width="2"
																	d="M20 12H4"
																/>
															</svg>
														</button>
														<span class="w-12 text-center text-sm font-semibold text-gray-900"
															>{qty}g</span
														>
														<button
															type="button"
															onclick={() => addIngredient(ingredient.id)}
															aria-label={$_('home.ingredient.increase', {
																values: { name: ingredient.name }
															})}
															class="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-900 text-white hover:bg-gray-800 transition-colors"
														>
															<svg
																class="w-4 h-4"
																fill="none"
																stroke="currentColor"
																viewBox="0 0 24 24"
															>
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
															onclick={() => setQuantity(ingredient.id, 50)}
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
			</div>
		</main>

		<!-- Right: Order Summary (Desktop) -->
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
								<li
									class="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg"
									transition:slide={{ duration: 150 }}
								>
									<span class="text-sm font-medium text-gray-900 truncate">{ingredient.name}</span>
									<span class="text-sm text-gray-500 ml-2 shrink-0">{quantity}g</span>
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
								<span class="block text-2xl font-bold text-gray-900"
									>{Math.round(totals.calories)}</span
								>
								<span class="block text-xs text-gray-500 uppercase tracking-wide"
									>{$_('home.order.calories')}</span
								>
							</div>
							<div class="bg-gray-50 rounded-lg py-3">
								<span class="block text-2xl font-bold text-gray-900"
									>{Math.round(totals.protein)}g</span
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
						onclick={submitOrder}
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
			<div class="flex items-center justify-between gap-4">
				<div>
					<span class="block text-xs text-gray-500"
						>{$_('home.order.items', { values: { count: selectedList.length } })}</span
					>
					<span class="block text-lg font-bold text-gray-900">{formatPrice(totals.price)} COP</span>
				</div>
				<button
					type="button"
					onclick={submitOrder}
					disabled={!canSubmit || submitting}
					class="flex-1 max-w-[200px] py-3 bg-gray-900 text-white rounded-xl font-semibold hover:bg-gray-800 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
				>
					{submitting ? $_('home.order.placing') : $_('home.order.placeOrder')}
				</button>
			</div>
		</div>
	</div>
</div>

<style>
	:global(body) {
		font-family: 'DM Sans', system-ui, sans-serif;
	}

	.safe-area-pb {
		padding-bottom: max(0.75rem, env(safe-area-inset-bottom));
	}
</style>
