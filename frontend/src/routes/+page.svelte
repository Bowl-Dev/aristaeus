<script lang="ts">
	import { onMount } from 'svelte';
	import { type Ingredient, type Menu as MenuType, type BowlSize } from '$lib/types';
	import { SvelteMap } from 'svelte/reactivity';
	import { getIngredients, getMenus, getConfig, ApiError } from '$lib/api/client';
	import { addBowl, removeAt, incrementAt, decrementAt, type BowlSnapshot } from '$lib/utils/cart';
	import Landing from '$lib/components/Landing.svelte';
	import LandingModal from '$lib/components/LandingModal.svelte';
	import Menu from '$lib/components/Menu.svelte';
	import Size from '$lib/components/Size.svelte';
	import Builder from '$lib/components/Builder.svelte';
	import Cart from '$lib/components/Cart.svelte';
	import Delivery from '$lib/components/Delivery.svelte';
	import ThnksModal from '$lib/components/ThnksModal.svelte';
	import PauseModal from '$lib/components/PauseModal.svelte';

	// View state
	let view = $state<'landing' | 'menu' | 'size' | 'builder' | 'cart' | 'delivery'>('landing');
	let showLandingModal = $state(false);
	let showThanks = $state(false);

	// Service-paused state (fail-open: stays false unless backend says otherwise)
	let ordersPaused = $state(false);
	let showPauseModal = $state(false);

	// Data
	let ingredients = $state<Ingredient[]>([]);
	let menus = $state<MenuType[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);

	// Bowl state
	let selectedBowlSize = $state<BowlSize | null>(null);
	let selectedItems = new SvelteMap<number, number>();
	let includeCutlery = $state(false);

	// Navigation breadcrumbs: track how the user entered Builder / Cart so the
	// back button returns to the actual previous view instead of always Landing.
	let builderEntry = $state<'size' | 'menu' | null>(null);
	let cartEntry = $state<'menu' | 'size' | 'builder'>('builder');

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

	// Fail-open: any error leaves ordering enabled so a config outage never
	// blocks the app. Runs independently of ingredient loading.
	async function loadConfig() {
		try {
			const config = await getConfig();
			ordersPaused = config.ordersPaused;
			if (ordersPaused) showPauseModal = true;
		} catch {
			ordersPaused = false;
		}
	}

	onMount(() => {
		loadIngredients();
		loadConfig();
	});

	function clearSelection() {
		selectedItems.clear();
		selectedBowlSize = null;
		includeCutlery = false;
	}

	function handleMenuSelect(
		menu: MenuType,
		scaledItems: { ingredientId: number; quantityGrams: number }[]
	) {
		clearSelection();
		selectedBowlSize = menu.bowlSize;
		scaledItems.forEach(({ ingredientId, quantityGrams }) => {
			selectedItems.set(ingredientId, quantityGrams);
		});
		builderEntry = 'menu';
		view = 'builder';
	}

	// Menu and Size are reached directly from Landing, so their back goes there.
	function backToLanding() {
		clearSelection();
		view = 'landing';
	}

	// Builder returns to whichever step opened it (Size or Menu). Ingredient
	// progress and bowl size are intentionally discarded on Back (see ENG-63).
	function handleBuilderBack() {
		const target = builderEntry === 'menu' ? 'menu' : 'size';
		clearSelection();
		builderEntry = null;
		view = target;
	}

	function goToCart() {
		if (bowls.length > 0) {
			cartEntry = view as 'menu' | 'size' | 'builder';
			view = 'cart';
		}
	}

	// Cart returns to the view that opened it (header cart icon from Menu/Size/
	// Builder, or add-to-cart from Builder), not unconditionally to Builder.
	function handleCartBack() {
		view = cartEntry;
	}

	function addCurrentBowlToCart() {
		bowls = addBowl(bowls, selectedBowlSize ?? 450, selectedItems, includeCutlery);
		clearSelection();
		cartEntry = 'builder';
		view = 'cart';
	}

	function handleRemoveBowl(index: number) {
		bowls = removeAt(bowls, index);
		if (bowls.length === 0) view = 'landing';
	}

	function handleIncreaseBowl(index: number) {
		bowls = incrementAt(bowls, index);
	}

	function handleDecreaseBowl(index: number) {
		// decrementAt clamps at 1, so this can never empty the cart.
		bowls = decrementAt(bowls, index);
	}
</script>

{#if error}
	<p class="p-4 text-center text-sm text-red-500">{error}</p>
{/if}

{#if view === 'landing'}
	<Landing
		onOrderNow={() => (ordersPaused ? (showPauseModal = true) : (showLandingModal = true))}
	/>
{:else if view === 'menu'}
	<Menu
		{menus}
		{loading}
		{cartCount}
		onBack={backToLanding}
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
		onBack={backToLanding}
		onCart={goToCart}
		onSelect={(size) => {
			selectedBowlSize = size;
			builderEntry = 'size';
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
		bind:includeCutlery
		onBack={handleBuilderBack}
		onCart={goToCart}
		onAddToCart={addCurrentBowlToCart}
	/>
{:else if view === 'cart'}
	<Cart
		{ingredients}
		{bowls}
		{cartCount}
		onBack={handleCartBack}
		onProceedToDelivery={() => (view = 'delivery')}
		onCreateAnother={() => (ordersPaused ? (showPauseModal = true) : (showLandingModal = true))}
		onRemoveBowl={handleRemoveBowl}
		onIncreaseBowl={handleIncreaseBowl}
		onDecreaseBowl={handleDecreaseBowl}
	/>
{:else if view === 'delivery'}
	<Delivery
		{ingredients}
		{bowls}
		{cartCount}
		onBack={() => (view = 'cart')}
		onOrderSuccess={() => {
			bowls = [];
			clearSelection();
			showThanks = true;
			view = 'landing';
		}}
	/>
{/if}

{#if showThanks}
	<ThnksModal onDismiss={() => (showThanks = false)} />
{/if}

{#if showPauseModal}
	<PauseModal onDismiss={() => (showPauseModal = false)} />
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
