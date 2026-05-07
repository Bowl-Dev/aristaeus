<script lang="ts">
	import {
		type Ingredient,
		type Menu as MenuType,
		type BowlSize,
		BOWL_SIZE_PRICES,
		DRESSING_CONTAINER_GRAMS
	} from '$lib/types';
	import { SvelteMap, SvelteSet } from 'svelte/reactivity';
	import { getIngredients, getMenus, createOrder, ApiError } from '$lib/api/client';
	import Landing from '$lib/components/Landing.svelte';
	import LandingModal from '$lib/components/LandingModal.svelte';
	import Menu from '$lib/components/Menu.svelte';
	import Size from '$lib/components/Size.svelte';
	import ThnksModal from '$lib/components/ThnksModal.svelte';

	// View state
	let view = $state<'landing' | 'menu' | 'size' | 'builder'>('landing');
	let showLandingModal = $state(false);

	// State
	let ingredients = $state<Ingredient[]>([]);
	let menus = $state<MenuType[]>([]);
	let loading = $state(true);
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	let error = $state<string | null>(null);
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	let submitting = $state(false);
	let orderSuccess = $state<{ orderId: number } | null>(null);

	// Form state - Customer info
	let customerName = $state('');
	let customerPhone = $state('');
	let customerEmail = $state('');

	// Form state - Colombian address
	let streetAddress = $state('');
	let neighborhood = $state('');
	let city = $state('Bogotá');
	let department = $state('Bogotá D.C.');
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

	// Load ingredients and menus
	async function loadIngredients() {
		loading = true;
		error = null;
		try {
			[ingredients, menus] = await Promise.all([getIngredients(), getMenus()]);
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

	// eslint-disable-next-line @typescript-eslint/no-unused-vars
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

	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	const capacityUsed = $derived(selectedBowlSize ? (totals.weight / selectedBowlSize) * 100 : 0);
	const isOverCapacity = $derived(selectedBowlSize ? totals.weight > selectedBowlSize : false);

	// Header cart count — single in-flight bowl, so a non-empty selection counts as 1.
	const cartCount = $derived(selectedItems.size > 0 ? 1 : 0);

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

	// Actions — used by the builder view (view = 'builder'), not yet wired to template
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	function toggleCategory(cat: string) {
		if (expandedCategories.has(cat)) {
			expandedCategories.delete(cat);
		} else {
			expandedCategories.add(cat);
		}
	}

	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	function addIngredient(id: number) {
		const ingredient = ingredients.find((i) => i.id === id);
		const increment = ingredient?.category === 'dressing' ? DRESSING_CONTAINER_GRAMS : 10;
		const current = selectedItems.get(id) || 0;
		selectedItems.set(id, current + increment);
	}

	// eslint-disable-next-line @typescript-eslint/no-unused-vars
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

	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	function setQuantity(id: number, qty: number) {
		if (qty <= 0) {
			selectedItems.delete(id);
		} else {
			selectedItems.set(id, qty);
		}
	}

	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	function getInitialQuantity(category: string): number {
		return category === 'dressing' ? DRESSING_CONTAINER_GRAMS : 50;
	}

	function clearAll() {
		selectedItems.clear();
		selectedBowlSize = null;
		isCutlery = false;
	}

	function handleMenuSelect(
		menu: MenuType,
		scaledItems: { ingredientId: number; quantityGrams: number }[]
	) {
		clearAll();
		selectedBowlSize = menu.bowlSize as BowlSize;
		scaledItems.forEach(({ ingredientId, quantityGrams }) => {
			selectedItems.set(ingredientId, quantityGrams);
		});
		view = 'builder';
	}

	function handleBack() {
		clearAll();
		view = 'landing';
	}

	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	function generateRandom() {
		const size: BowlSize = selectedBowlSize ?? 450;
		selectedBowlSize = size;

		const portions: Record<string, number> =
			size === 250
				? { base: 80, protein: 60, vegetable: 40, topping: 20, dressing: 25 }
				: size === 450
					? { base: 140, protein: 100, vegetable: 50, topping: 30, dressing: 25 }
					: { base: 180, protein: 120, vegetable: 70, topping: 40, dressing: 50 };

		selectedItems.clear();

		sortedCategories.forEach((cat) => {
			const catIngredients = ingredientsByCategory[cat];
			if (catIngredients?.length) {
				const pick = catIngredients[Math.floor(Math.random() * catIngredients.length)];
				selectedItems.set(pick.id, portions[cat] || 50);
			}
		});
	}

	// eslint-disable-next-line @typescript-eslint/no-unused-vars
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

{#if view === 'landing'}
	<Landing onOrderNow={() => (showLandingModal = true)} />

	{#if showLandingModal}
		<LandingModal
			onFromScratch={() => {
				showLandingModal = false;
				view = 'size';
			}}
			onMenu={() => {
				showLandingModal = false;
				view = 'menu';
			}}
			onCancel={() => (showLandingModal = false)}
		/>
	{/if}
{:else if view === 'menu'}
	<Menu
		{menus}
		{loading}
		{cartCount}
		onBack={handleBack}
		onCustomize={(menu) => {
			handleMenuSelect(
				menu,
				menu.ingredients.map((i) => ({
					ingredientId: i.ingredientId,
					quantityGrams: i.quantityGrams
				}))
			);
		}}
	/>
{:else if view === 'size'}
	<Size
		{cartCount}
		onBack={() => (view = 'landing')}
		onSelect={(size) => {
			selectedBowlSize = size;
			view = 'builder';
		}}
	/>
{:else if view === 'builder'}
	<!-- Builder view coming soon -->
	<div class="builder-placeholder">
		<p>Builder — bowl size: {selectedBowlSize}g</p>
		<button onclick={handleBack}>Volver</button>
		<button onclick={() => (orderSuccess = { orderId: 0 })}>Simular pedido exitoso</button>
	</div>
{/if}

{#if orderSuccess}
	<ThnksModal
		onDismiss={() => {
			orderSuccess = null;
			view = 'landing';
		}}
	/>
{/if}

<style>
	.builder-placeholder {
		min-height: 100svh;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 1rem;
		background: #f7f7f7;
		color: #333;
	}

	.builder-placeholder button {
		padding: 0.75rem 1.5rem;
		background: #00483c;
		color: white;
		border: none;
		border-radius: 9999px;
		cursor: pointer;
		font-weight: 600;
	}
</style>
