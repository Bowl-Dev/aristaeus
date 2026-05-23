<script lang="ts">
	import { type Ingredient, type Menu as MenuType, type BowlSize } from '$lib/types';
	import { SvelteMap } from 'svelte/reactivity';
	import { getIngredients, getMenus, ApiError } from '$lib/api/client';
	import Landing from '$lib/components/Landing.svelte';
	import LandingModal from '$lib/components/LandingModal.svelte';
	import Menu from '$lib/components/Menu.svelte';
	import Size from '$lib/components/Size.svelte';
	import Builder from '$lib/components/Builder.svelte';
	import Cart from '$lib/components/Cart.svelte';

	interface BowlSnapshot {
		bowlSize: BowlSize;
		items: Map<number, number>;
		quantity: number;
	}

	// View state
	let view = $state<'landing' | 'menu' | 'size' | 'builder' | 'cart'>('landing');
	let showLandingModal = $state(false);

	// Data
	let ingredients = $state<Ingredient[]>([]);
	let menus = $state<MenuType[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);

	// Bowl state
	let selectedBowlSize = $state<BowlSize | null>(null);
	let selectedItems = new SvelteMap<number, number>();

	// Cart: saved bowl snapshots with quantity multiplier
	let bowls = $state<BowlSnapshot[]>([]);
	const cartCount = $derived(bowls.length);

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

	function clearSelection() {
		selectedItems.clear();
		selectedBowlSize = null;
	}

	function handleMenuSelect(
		menu: MenuType,
		scaledItems: { ingredientId: number; quantityGrams: number }[]
	) {
		clearSelection();
		selectedBowlSize = menu.bowlSize as BowlSize;
		scaledItems.forEach(({ ingredientId, quantityGrams }) => {
			selectedItems.set(ingredientId, quantityGrams);
		});
		view = 'builder';
	}

	function handleBack() {
		clearSelection();
		view = 'landing';
	}

	function goToCart() {
		if (bowls.length > 0) view = 'cart';
	}

	function addCurrentBowlToCart() {
		bowls = [
			...bowls,
			{ bowlSize: selectedBowlSize ?? 450, items: new Map(selectedItems), quantity: 1 }
		];
		clearSelection();
		view = 'cart';
	}
</script>

{#if error}
	<p class="p-4 text-center text-sm text-red-500">{error}</p>
{/if}

{#if view === 'landing'}
	<Landing onOrderNow={() => (showLandingModal = true)} />
{:else if view === 'menu'}
	<Menu
		{menus}
		{loading}
		{cartCount}
		onBack={handleBack}
		onCart={goToCart}
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
		onBack={handleBack}
		onCart={goToCart}
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
		onBack={handleBack}
		onCart={goToCart}
		onAddToCart={addCurrentBowlToCart}
	/>
{:else if view === 'cart'}
	<Cart
		{ingredients}
		{bowls}
		{cartCount}
		onBack={() => (view = 'builder')}
		onProceedToDelivery={() => {
			// Delivery flow is shipped in PR #19; clear cart and return to landing as a placeholder.
			bowls = [];
			view = 'landing';
		}}
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
{/if}

{#if showLandingModal}
	<LandingModal
		onFromScratch={() => {
			showLandingModal = false;
			clearSelection();
			view = 'size';
		}}
		onMenu={() => {
			showLandingModal = false;
			clearSelection();
			view = 'menu';
		}}
		onCancel={() => (showLandingModal = false)}
	/>
{/if}
