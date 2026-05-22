<script lang="ts">
	import { type Ingredient, type Menu as MenuType, type BowlSize } from '$lib/types';
	import { SvelteMap } from 'svelte/reactivity';
	import { getIngredients, getMenus, ApiError } from '$lib/api/client';
	import Landing from '$lib/components/Landing.svelte';
	import LandingModal from '$lib/components/LandingModal.svelte';
	import Menu from '$lib/components/Menu.svelte';
	import Size from '$lib/components/Size.svelte';
	import Builder from '$lib/components/Builder.svelte';

	// View state
	let view = $state<'landing' | 'menu' | 'size' | 'builder'>('landing');
	let showLandingModal = $state(false);

	// Data
	let ingredients = $state<Ingredient[]>([]);
	let menus = $state<MenuType[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);

	// Bowl state
	let selectedBowlSize = $state<BowlSize | null>(null);
	let selectedItems = new SvelteMap<number, number>();

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

	// Cart wiring lives in the follow-up PR (#18); no items can be in a cart yet.
	const cartCount = 0;

	function clearAll() {
		selectedItems.clear();
		selectedBowlSize = null;
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
</script>

{#if error}
	<p class="p-4 text-center text-sm text-red-500">{error}</p>
{/if}

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
	<Builder
		{ingredients}
		{loading}
		bowlSize={selectedBowlSize ?? 450}
		{selectedItems}
		{cartCount}
		onBack={handleBack}
		onAddToCart={handleBack}
	/>
{/if}
