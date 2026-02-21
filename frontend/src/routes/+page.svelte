<script lang="ts">
	import {
		type Ingredient,
		type BowlSize,
		BOWL_SIZE_PRICES,
		DRESSING_CONTAINER_GRAMS
	} from '$lib/types';
	import { SvelteMap, SvelteSet } from 'svelte/reactivity';
	import { getIngredients, createOrder, ApiError } from '$lib/api/client';
	import { fade } from 'svelte/transition';
	import { _ } from 'svelte-i18n';

	// Import components
	import CustomerForm from '$lib/components/CustomerForm.svelte';
	import BowlIngredients from '$lib/components/BowlIngredients.svelte';
	import OrderSummary from '$lib/components/OrderSummary.svelte';

	// State
	let ingredients = $state<Ingredient[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let submitting = $state(false);
	let orderSuccess = $state<{ orderId: number } | null>(null);

	// Form state - Customer info
	let customerName = $state('');
	let customerPhone = $state('');
	let customerEmail = $state('');

	// Form state - Colombian address
	let streetAddress = $state('');
	let neighborhood = $state('');
	let city = $state('');
	let department = $state('');
	let postalCode = $state('');

	// Form state - Bowl
	let selectedBowlSize = $state<BowlSize | null>(null);
	let selectedItems = new SvelteMap<number, number>();
	let expandedCategories = new SvelteSet<string>(['base']);
	let isCutlery = $state(false);

	// Returning customer state
	let updateUserData = $state(false);

	// Validation helpers
	const isValidColombianPhone = $derived(
		/^(\+57)?[0-9]{10}$/.test(customerPhone.replace(/\s/g, ''))
	);

	const isValidEmail = $derived(
		customerEmail.length === 0 || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)
	);

	const isValidPostalCode = $derived(postalCode.length === 0 || /^[0-9]{6}$/.test(postalCode));

	const isAddressComplete = $derived(
		streetAddress.trim().length >= 5 &&
			neighborhood.trim().length >= 2 &&
			city.trim().length >= 2 &&
			department.trim().length >= 2
	);

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
			isValidColombianPhone &&
			isAddressComplete &&
			isValidEmail &&
			isValidPostalCode &&
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
		const ingredient = ingredients.find((i) => i.id === id);
		const increment = ingredient?.category === 'dressing' ? DRESSING_CONTAINER_GRAMS : 10;
		const current = selectedItems.get(id) || 0;
		selectedItems.set(id, current + increment);
	}

	function removeIngredient(id: number) {
		const ingredient = ingredients.find((i) => i.id === id);
		const decrement = ingredient?.category === 'dressing' ? DRESSING_CONTAINER_GRAMS : 10;
		const current = selectedItems.get(id) || 0;
		if (current <= decrement) {
			selectedItems.delete(id);
		} else {
			selectedItems.set(id, current - decrement);
		}
	}

	function setQuantity(id: number, qty: number) {
		if (qty <= 0) {
			selectedItems.delete(id);
		} else {
			selectedItems.set(id, qty);
		}
	}

	function getInitialQuantity(category: string): number {
		return category === 'dressing' ? DRESSING_CONTAINER_GRAMS : 50;
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
				bowlSize: selectedBowlSize,
				customer: {
					name: customerName,
					phone: customerPhone,
					email: customerEmail || undefined,
					address: {
						streetAddress,
						neighborhood,
						city,
						department,
						postalCode: postalCode || undefined
					}
				},
				items,
				includeCutlery: isCutlery,
				updateUserData
			});

			orderSuccess = { orderId: response.orderId };

			// Reset form
			customerName = '';
			customerPhone = '';
			customerEmail = '';
			streetAddress = '';
			neighborhood = '';
			city = '';
			department = '';
			postalCode = '';
			selectedBowlSize = null;
			selectedItems.clear();
			isCutlery = false;
			updateUserData = false;
		} catch (e) {
			alert(e instanceof ApiError ? e.message : 'Failed to submit order');
		} finally {
			submitting = false;
		}
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
		<!-- Left: Form and Ingredients -->
		<main class="flex-1 lg:mr-[420px]">
			<div class="max-w-2xl mx-auto px-6 py-8">
				<!-- Header -->
				<header class="mb-8">
					<h1 class="text-3xl font-bold text-gray-900 tracking-tight">{$_('home.title')}</h1>
					<p class="text-gray-500 mt-1">{$_('home.subtitle')}</p>
				</header>

				<!-- Customer Form Component -->
				<CustomerForm
					bind:customerName
					bind:customerPhone
					bind:customerEmail
					bind:streetAddress
					bind:neighborhood
					bind:city
					bind:department
					bind:postalCode
					bind:updateUserData
				/>

				<!-- Bowl Ingredients Component -->
				<BowlIngredients
					{ingredients}
					{loading}
					{error}
					bind:selectedBowlSize
					bind:isCutlery
					{selectedItems}
					{expandedCategories}
					onLoadIngredients={loadIngredients}
					onAddIngredient={addIngredient}
					onRemoveIngredient={removeIngredient}
					onSetQuantity={setQuantity}
					onClearAll={clearAll}
					onGenerateRandom={generateRandom}
					onToggleCategory={toggleCategory}
					{getInitialQuantity}
				/>
			</div>
		</main>

		<!-- Order Summary Component (Desktop sidebar + Mobile bar) -->
		<OrderSummary
			{customerName}
			{selectedBowlSize}
			{selectedList}
			{totals}
			{capacityUsed}
			{isOverCapacity}
			{canSubmit}
			{submitting}
			onSubmit={submitOrder}
		/>
	</div>
</div>

<style>
	:global(body) {
		font-family: 'DM Sans', system-ui, sans-serif;
	}
</style>
