<script lang="ts">
	import {
		type Ingredient,
		type BowlSize,
		type NutritionalSummary as NutritionalSummaryType,
		BOWL_SIZES,
		BOWL_SIZE_PRICES
	} from '$lib/types';
	import { SvelteMap } from 'svelte/reactivity';
	import IngredientCard from '$lib/components/IngredientCard.svelte';
	import BowlSizeSelector from '$lib/components/BowlSizeSelector.svelte';
	import NutritionalSummary from '$lib/components/NutritionalSummary.svelte';
	import { _ } from 'svelte-i18n';
	import { getIngredients, createOrder, ApiError } from '$lib/api/client';

	let yes = $state(false);
	let isCutlery = $state(false);

	let ingredients = $state<Ingredient[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let submitting = $state(false);
	let orderSuccess = $state<{ orderId: number; status: string } | null>(null);

	async function loadIngredients() {
		loading = true;
		error = null;
		try {
			ingredients = await getIngredients();
		} catch (e) {
			error = e instanceof ApiError ? e.message : 'Failed to load ingredients';
			console.error('Failed to fetch ingredients:', e);
		} finally {
			loading = false;
		}
	}

	$effect(() => {
		loadIngredients();
	});

	const ingredientsByCategory = $derived.by(() => {
		const grouped: Record<string, Ingredient[]> = {};
		ingredients.forEach((ingredient) => {
			if (!grouped[ingredient.category]) {
				grouped[ingredient.category] = [];
			}
			grouped[ingredient.category].push(ingredient);
		});
		return grouped;
	});

	const priority: Record<string, number> = {
		base: 0,
		vegetable: 1,
		protein: 2,
		topping: 3,
		dressing: 4
	};

	let orderedCategories = $derived(
		Object.fromEntries(
			Object.entries(ingredientsByCategory).sort(([a], [b]) => {
				const orderA = priority[a] ?? 999;
				const orderB = priority[b] ?? 999;
				return orderA - orderB;
			})
		)
	);

	let customerName = $state('');
	let customerPhone = $state('');
	let selectedBowlSize = $state<BowlSize | null>(null);
	let selectedItems = new SvelteMap<number, number>();

	function setDefaultBowlSize() {
		return (selectedBowlSize = BOWL_SIZES[1]);
	}
	function setDefaultBowlIng() {
		return (selectedItems = new SvelteMap([
			[107, 40],
			[102, 140],
			[104, 40],
			[106, 40],
			[108, 40],
			[100, 120],
			[115, 25]
		]));
	}

	const nutritionalSummary = $derived.by((): NutritionalSummaryType => {
		let totals: NutritionalSummaryType = {
			calories: 0,
			proteinG: 0,
			carbsG: 0,
			fatG: 0,
			fiberG: 0,
			totalWeightG: 0,
			totalPrice: 0
		};
		if (selectedBowlSize == BOWL_SIZES[0]) {
			totals.totalPrice = BOWL_SIZE_PRICES[0];
		}
		if (selectedBowlSize == BOWL_SIZES[1]) {
			totals.totalPrice = BOWL_SIZE_PRICES[1];
		}
		if (selectedBowlSize == BOWL_SIZES[2]) {
			totals.totalPrice = BOWL_SIZE_PRICES[2];
		}
		if (isCutlery == true) {
			totals.totalPrice += 300;
		}

		selectedItems.forEach((quantityGrams, ingredientId) => {
			const ingredient = ingredients.find((i) => i.id === ingredientId);
			if (ingredient && quantityGrams > 0) {
				const multiplier = quantityGrams / 100;
				totals.calories += ingredient.caloriesPer100g * multiplier;
				totals.proteinG += ingredient.proteinGPer100g * multiplier;
				totals.carbsG += ingredient.carbsGPer100g * multiplier;
				totals.fatG += ingredient.fatGPer100g * multiplier;
				totals.fiberG += (ingredient.fiberGPer100g || 0) * multiplier;
				totals.totalWeightG += quantityGrams;
				totals.totalPrice += ingredient.pricePerG * (multiplier * 100);
			}
		});

		return totals;
	});

	const remainingCapacity = $derived(
		selectedBowlSize ? selectedBowlSize - nutritionalSummary.totalWeightG : null
	);

	const capacityExceeded = $derived(remainingCapacity !== null && remainingCapacity < 0);

	const isFormValid = $derived(
		customerName.trim().length > 0 &&
			selectedBowlSize !== null &&
			selectedItems.size > 0 &&
			!capacityExceeded
	);

	function updateQuantity(ingredientId: number, quantity: number) {
		if (quantity > 0) {
			selectedItems.set(ingredientId, quantity);
		} else {
			selectedItems.delete(ingredientId);
		}
	}

	async function submitOrder() {
		if (!isFormValid || !selectedBowlSize) return;

		submitting = true;
		orderSuccess = null;

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

			orderSuccess = { orderId: response.orderId, status: response.status };
			customerName = '';
			selectedBowlSize = null;
			selectedItems = new SvelteMap();
		} catch (e) {
			const message = e instanceof ApiError ? e.message : 'Failed to submit order';
			alert(`Error: ${message}`);
			console.error('Order submission failed:', e);
		} finally {
			submitting = false;
		}
	}

	function getCategoryName(category: string): string {
		return $_(`ingredients.categories.${category}`);
	}

	function getIngredientName(name: string): string {
		return $_(`ingredients.names.${name}`);
	}
</script>

<main class="p-4 md:p-8 max-w-6xl mx-auto">
	<h1 class="text-4xl font-bold mb-2">{$_('app.title')}</h1>
	<p class="text-surface-600 dark:text-surface-400 text-lg mb-8">{$_('app.subtitle')}</p>

	{#if orderSuccess}
		<div class="card bg-success-500 text-white p-6 mb-6 text-center rounded-xl">
			<p class="font-semibold text-lg">Order #{orderSuccess.orderId} created successfully!</p>
			<p>Status: {orderSuccess.status}</p>
			<button
				class="btn bg-white text-success-700 mt-4 font-semibold"
				onclick={() => (orderSuccess = null)}
			>
				Create Another Order
			</button>
		</div>
	{/if}

	{#if error}
		<div class="card bg-error-500 text-white p-6 mb-6 text-center rounded-xl">
			<p>{error}</p>
			<button class="btn bg-white text-error-700 mt-4 font-semibold" onclick={loadIngredients}
				>Try Again</button
			>
		</div>
	{/if}

	<div class="card bg-surface-100 dark:bg-surface-800 p-6 md:p-8 rounded-xl shadow-lg">
		<!-- Customer Name and Phone Section-->
		<section class="mb-8 pb-8 border-b border-surface-300 dark:border-surface-700">
			<h2 class="text-2xl font-bold mb-4">{$_('customerInfo.title')}</h2>
			<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
				<div class="flex flex-col gap-2">
					<label for="customer-name" class="font-semibold">{$_('customerInfo.nameLabel')}</label>
					<input
						id="customer-name"
						type="text"
						bind:value={customerName}
						placeholder={$_('customerInfo.namePlaceholder')}
						class="input bg-surface-50 dark:bg-surface-900 border-surface-300 dark:border-surface-600 rounded-lg p-3"
						required
					/>
				</div>
				<div class="flex flex-col gap-2">
					<label for="customer-phone" class="font-semibold">{$_('customerInfo.phoneLabel')}</label>
					<input
						id="customer-phone"
						type="text"
						bind:value={customerPhone}
						placeholder={$_('customerInfo.phonePlaceholder')}
						class="input bg-surface-50 dark:bg-surface-900 border-surface-300 dark:border-surface-600 rounded-lg p-3"
						required
					/>
				</div>
			</div>
		</section>

		<div class="mb-6">
			<label class="flex items-center gap-3 text-lg font-bold cursor-pointer">
				<input
					type="checkbox"
					bind:checked={yes}
					onchange={() => {
						setDefaultBowlSize();
						setDefaultBowlIng();
					}}
					class="checkbox size-6 rounded bg-surface-200 dark:bg-surface-700"
				/>
				{$_('app.defaultBowl')}
			</label>
		</div>

		<!-- Bowl Size Selection -->
		<BowlSizeSelector
			selectedSize={selectedBowlSize}
			onSizeChange={(size) => (selectedBowlSize = size)}
		/>

		<!-- Ingredient Selection Section -->
		<section class="mb-8 pb-8 border-b border-surface-300 dark:border-surface-700">
			<h2 class="text-2xl font-bold mb-4">{$_('ingredients.title')}</h2>

			{#if loading}
				<div class="text-center py-12 text-surface-500">
					<p>Loading ingredients...</p>
				</div>
			{:else if ingredients.length === 0}
				<div class="text-center py-12 text-surface-500">
					<p>No ingredients available at this time.</p>
				</div>
			{:else}
				{#each Object.entries(orderedCategories) as [category, items] (category)}
					<div class="mb-8">
						<h3 class="text-xl font-bold text-primary-500 mb-4 capitalize">
							{getCategoryName(category)}
						</h3>
						<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
							{#each items as ingredient (ingredient.id)}
								<IngredientCard
									{ingredient}
									ingredientName={getIngredientName(ingredient.name)}
									ingredientCategory={getCategoryName(category)}
									isSelected={selectedItems.has(ingredient.id)}
									quantity={selectedItems.get(ingredient.id) || 0}
									onSelect={() => updateQuantity(ingredient.id, 50)}
									onRemove={() => updateQuantity(ingredient.id, 0)}
									onQuantityChange={(qty) => updateQuantity(ingredient.id, qty)}
								/>
							{/each}
						</div>
					</div>
				{/each}
			{/if}
		</section>

		<!-- Cutlery check -->
		<div class="mb-6">
			<label class="flex items-center gap-3 text-lg font-bold cursor-pointer">
				<input
					type="checkbox"
					bind:checked={isCutlery}
					class="checkbox size-6 rounded bg-surface-200 dark:bg-surface-700"
				/>
				{$_('app.cutlery')}
			</label>
		</div>

		<!-- Nutritional Summary -->
		<NutritionalSummary nutrition={nutritionalSummary} bowlSize={selectedBowlSize} />

		<!-- Submit Button -->
		<div class="flex justify-center pt-4">
			<button
				class="btn bg-primary-500 hover:bg-primary-600 text-white text-lg px-12 py-3 font-semibold rounded-lg shadow-md hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
				disabled={!isFormValid || submitting}
				onclick={submitOrder}
			>
				{#if submitting}
					Submitting...
				{:else}
					{$_('order.submit')}
				{/if}
			</button>
		</div>
	</div>
</main>
