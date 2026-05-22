<script lang="ts">
	import {
		type Ingredient,
		type Menu as MenuType,
		type BowlSize,
		BOWL_SIZE_PRICES,
		DRESSING_CONTAINER_GRAMS
	} from '$lib/types';
	import { SvelteMap, SvelteSet } from 'svelte/reactivity';
	import { getIngredients, getMenus, ApiError } from '$lib/api/client';
	import Landing from '$lib/components/Landing.svelte';
	import LandingModal from '$lib/components/LandingModal.svelte';
	import Menu from '$lib/components/Menu.svelte';
	import Size from '$lib/components/Size.svelte';
	import Builder from '$lib/components/Builder.svelte';
	import Cart from '$lib/components/Cart.svelte';
	import Delivery from '$lib/components/Delivery.svelte';
	import ThnksModal from '$lib/components/ThnksModal.svelte';

	// View state
	let view = $state<'landing' | 'menu' | 'size' | 'builder' | 'cart' | 'delivery'>('landing');
	let showLandingModal = $state(false);
	let showThnks = $state(false);

	// State
	let ingredients = $state<Ingredient[]>([]);
	let menus = $state<MenuType[]>([]);
	let loading = $state(true);
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	let error = $state<string | null>(null);

	// Form state - Bowl
	let selectedBowlSize = $state<BowlSize | null>(null);
	let selectedItems = new SvelteMap<number, number>();
	let expandedCategories = new SvelteSet<string>(['base']);
	let isCutlery = $state(false);

	// Cart: saved bowl snapshots with quantity multiplier
	let bowls = $state<Array<{ bowlSize: BowlSize; items: Map<number, number>; quantity: number }>>(
		[]
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
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	const isOverCapacity = $derived(selectedBowlSize ? totals.weight > selectedBowlSize : false);

	const cartCount = $derived(bowls.length);

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
</script>

{#if showThnks}
	<ThnksModal onDismiss={() => (showThnks = false)} />
{/if}

{#if showLandingModal}
	<LandingModal
		onFromScratch={() => {
			showLandingModal = false;
			selectedBowlSize = null;
			selectedItems.clear();
			view = 'size';
		}}
		onMenu={() => {
			showLandingModal = false;
			selectedBowlSize = null;
			selectedItems.clear();
			view = 'menu';
		}}
		onCancel={() => (showLandingModal = false)}
	/>
{/if}

{#if view === 'landing'}
	<Landing onOrderNow={() => (showLandingModal = true)} />
{:else if view === 'menu'}
	<Menu
		{menus}
		{loading}
		{cartCount}
		onBack={() => {
			if (bowls.length > 0) {
				view = 'cart';
			} else {
				handleBack();
			}
		}}
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
		onBack={() => {
			if (bowls.length > 0) {
				view = 'cart';
			} else {
				view = 'landing';
			}
		}}
		onSelect={(size) => {
			selectedBowlSize = size;
			view = 'builder';
		}}
	/>
{:else if view === 'builder'}
	<Builder
		{ingredients}
		{loading}
		bowlSize={selectedBowlSize ?? 450}
		{selectedItems}
		{cartCount}
		onBack={() => {
			if (bowls.length > 0) {
				view = 'cart';
			} else {
				handleBack();
			}
		}}
		onAddToCart={() => {
			bowls = [
				...bowls,
				{ bowlSize: selectedBowlSize ?? 450, items: new Map(selectedItems), quantity: 1 }
			];
			selectedItems.clear();
			selectedBowlSize = null;
			view = 'cart';
		}}
	/>
{:else if view === 'cart'}
	<Cart
		{ingredients}
		{bowls}
		{cartCount}
		onBack={() => (view = 'builder')}
		onProceedToDelivery={() => (view = 'delivery')}
		onCreateAnother={() => (showLandingModal = true)}
		onRemoveBowl={(index) => {
			bowls = bowls.filter((_, i) => i !== index);
			if (bowls.length === 0) view = 'landing';
		}}
		onIncreaseBowl={(index) => {
			bowls = bowls.map((b, i) => (i === index ? { ...b, quantity: b.quantity + 1 } : b));
		}}
		onDecreaseBowl={(index) => {
			const current = bowls[index].quantity;
			if (current <= 1) {
				bowls = bowls.filter((_, i) => i !== index);
				if (bowls.length === 0) view = 'landing';
			} else {
				bowls = bowls.map((b, i) => (i === index ? { ...b, quantity: b.quantity - 1 } : b));
			}
		}}
	/>
{:else if view === 'delivery'}
	<Delivery
		{ingredients}
		{bowls}
		{cartCount}
		onBack={() => (view = 'cart')}
		onOrderSuccess={() => {
			showThnks = true;
			bowls = [];
			view = 'landing';
		}}
	/>
{/if}
