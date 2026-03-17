<script lang="ts">
	import { type Ingredient, type IngredientCategory, DRESSING_CONTAINER_GRAMS } from '$lib/types';
	import { gramsToImperial } from '$lib/utils/imperialConversion';
	import { slide } from 'svelte/transition';
	import { _ } from 'svelte-i18n';

	// Type definitions
	interface SelectedItem {
		ingredient: Ingredient;
		quantity: number;
	}

	interface Totals {
		calories: number;
		protein: number;
		weight: number;
		price: number;
	}

	// Props
	let {
		customerName,
		selectedBowlSize,
		selectedList,
		totals,
		capacityUsed,
		isOverCapacity,
		canSubmit,
		submitting,
		onSubmit
	}: {
		customerName: string;
		selectedBowlSize: number | null;
		selectedList: SelectedItem[];
		totals: Totals;
		capacityUsed: number;
		isOverCapacity: boolean;
		canSubmit: boolean;
		submitting: boolean;
		onSubmit: () => void;
	} = $props();

	// Drawer state
	let drawerOpen = $state(false);
	let dragY = $state(0);
	let dragStartY = 0;
	let isDragging = $state(false);

	function openDrawer() {
		drawerOpen = true;
		dragY = 0;
	}
	function closeDrawer() {
		drawerOpen = false;
		dragY = 0;
	}
	function handleMobileSubmit() {
		closeDrawer();
		onSubmit();
	}

	// Body scroll lock (Android-safe)
	// Android: position:fixed + overflow:hidden causes page-scroll-to-top jump.
	// Fix: save scrollY, apply negative top offset, restore on close.
	let savedScrollY = 0;

	$effect(() => {
		if (drawerOpen) {
			savedScrollY = window.scrollY;
			document.body.style.overflow = 'hidden';
			document.body.style.position = 'fixed';
			document.body.style.top = `-${savedScrollY}px`;
			document.body.style.width = '100%';
		} else {
			document.body.style.overflow = '';
			document.body.style.position = '';
			document.body.style.top = '';
			document.body.style.width = '';
			window.scrollTo(0, savedScrollY);
		}
		return () => {
			document.body.style.overflow = '';
			document.body.style.position = '';
			document.body.style.top = '';
			document.body.style.width = '';
			window.scrollTo(0, savedScrollY);
		};
	});

	// Action to attach touchmove with passive:false (required for preventDefault)
	function nonPassiveTouchMove(node: HTMLElement) {
		node.addEventListener('touchmove', handleTouchMove, { passive: false });
		return {
			destroy() {
				node.removeEventListener('touchmove', handleTouchMove);
			}
		};
	}

	// Swipe-to-close gesture (handle area only)
	function handleTouchStart(e: TouchEvent) {
		isDragging = true;
		dragStartY = e.touches[0].clientY;
		dragY = 0;
	}

	function handleTouchMove(e: TouchEvent) {
		if (!isDragging) return;
		const delta = e.touches[0].clientY - dragStartY;
		// Only allow downward drag
		if (delta > 0) {
			dragY = delta;
			e.preventDefault();
		}
	}

	function handleTouchEnd() {
		isDragging = false;
		if (dragY > 80) {
			closeDrawer();
		} else {
			dragY = 0;
		}
	}

	// Focus trap
	$effect(() => {
		if (!drawerOpen) return;
		const panel = document.querySelector<HTMLElement>('[data-drawer-panel]');
		if (!panel) return;
		const sel = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
		const els = Array.from(panel.querySelectorAll<HTMLElement>(sel));
		els[0]?.focus();
		function trap(e: KeyboardEvent) {
			if (e.key !== 'Tab') return;
			const first = els[0],
				last = els[els.length - 1];
			if (e.shiftKey ? document.activeElement === first : document.activeElement === last) {
				e.preventDefault();
				(e.shiftKey ? last : first)?.focus();
			}
		}
		document.addEventListener('keydown', trap);
		return () => document.removeEventListener('keydown', trap);
	});

	// Helper functions
	function formatPrice(cop: number): string {
		return `$${Math.round(cop / 100) * 100}`;
	}

	function getIngredientName(name: string): string {
		return $_(`ingredients.${name}`) || name;
	}

	function formatImperial(quantity: string, unit: string): string {
		const translatedUnit = $_(`home.ingredient.${unit}`, { values: { quantity } });
		return `~${translatedUnit}`;
	}
</script>

<svelte:window
	onkeydown={(e) => {
		if (e.key === 'Escape' && drawerOpen) closeDrawer();
	}}
/>

<!-- Desktop: Order Summary Sidebar -->
<aside class="hidden lg:block fixed right-0 top-0 bottom-0 w-105 bg-white border-l border-gray-200">
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
						{@const isDressing = ingredient.category === 'dressing'}
						{@const containers = isDressing ? quantity / DRESSING_CONTAINER_GRAMS : null}
						{@const imperial = gramsToImperial(quantity, ingredient.category as IngredientCategory)}
						<li
							class="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg"
							transition:slide={{ duration: 150 }}
						>
							<span class="text-sm font-medium text-gray-900 truncate"
								>{getIngredientName(ingredient.name)}</span
							>
							<span class="text-sm text-gray-500 ml-2 shrink-0">
								{#if isDressing}
									{containers}
									{containers === 1
										? $_('home.ingredient.container')
										: $_('home.ingredient.containers')}
									({quantity}g)
								{:else}
									{quantity}g ({formatImperial(imperial.quantity, imperial.unit)})
								{/if}
							</span>
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
						<span class="block text-2xl font-bold text-gray-900">{Math.round(totals.calories)}</span
						>
						<span class="block text-xs text-gray-500 uppercase tracking-wide"
							>{$_('home.order.calories')}</span
						>
					</div>
					<div class="bg-gray-50 rounded-lg py-3">
						<span class="block text-2xl font-bold text-gray-900">{Math.round(totals.protein)}g</span
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
				onclick={onSubmit}
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

<!-- Mobile: Bottom Sheet Drawer -->
<div class="lg:hidden">
	<!-- Part A: Backdrop -->
	<div
		role="button"
		tabindex="0"
		aria-label="Close order summary"
		class="drawer-backdrop fixed inset-0 bg-black/50 z-60 {drawerOpen ? 'open' : ''}"
		onclick={closeDrawer}
		onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && closeDrawer()}
	></div>

	<!-- Part B: Drawer panel -->
	<div
		data-drawer-panel
		role="dialog"
		aria-modal="true"
		aria-label={$_('home.order.title')}
		aria-hidden={!drawerOpen}
		class="drawer-panel fixed bottom-0 left-0 right-0 h-[85svh] bg-white rounded-t-2xl z-61 flex flex-col {drawerOpen
			? 'open'
			: ''}"
		class:dragging={isDragging}
		style="transform: translateY({isDragging && dragY > 0
			? `${dragY}px`
			: drawerOpen
				? '0px'
				: '100%'})"
	>
		<!-- Drag handle — swipe-to-close target -->
		<button
			type="button"
			onclick={closeDrawer}
			aria-label="Close order summary"
			ontouchstart={handleTouchStart}
			use:nonPassiveTouchMove
			ontouchend={handleTouchEnd}
			class="flex justify-center pt-3 pb-2 w-full shrink-0 focus:outline-none touch-none"
		>
			<div class="w-10 h-1 bg-gray-300 rounded-full"></div>
		</button>

		<!-- Header -->
		<div class="px-6 pb-4 shrink-0">
			<h2 class="text-xl font-bold text-gray-900">{$_('home.order.title')}</h2>
			{#if customerName}
				<p class="text-sm text-gray-500 mt-1">
					{$_('home.order.for', { values: { name: customerName } })}
				</p>
			{/if}
		</div>

		<!-- Capacity bar -->
		{#if selectedBowlSize}
			<div class="px-6 mb-4 shrink-0">
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

		<!-- Scrollable items list -->
		<div class="flex-1 overflow-y-auto min-h-0 px-6 overscroll-contain">
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
						{@const isDressing = ingredient.category === 'dressing'}
						{@const containers = isDressing ? quantity / DRESSING_CONTAINER_GRAMS : null}
						{@const imperial = gramsToImperial(quantity, ingredient.category as IngredientCategory)}
						<li
							class="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg"
							transition:slide={{ duration: 150 }}
						>
							<span class="text-sm font-medium text-gray-900 truncate">
								{getIngredientName(ingredient.name)}
							</span>
							<span class="text-sm text-gray-500 ml-2 shrink-0">
								{#if isDressing}
									{containers}
									{containers === 1
										? $_('home.ingredient.container')
										: $_('home.ingredient.containers')}
									({quantity}g)
								{:else}
									{quantity}g ({formatImperial(imperial.quantity, imperial.unit)})
								{/if}
							</span>
						</li>
					{/each}
				</ul>
			{/if}
		</div>

		<!-- Nutrition summary -->
		{#if selectedList.length > 0}
			<div class="px-6 border-t border-gray-100 pt-4 mt-2 shrink-0">
				<div class="grid grid-cols-2 gap-3 text-center">
					<div class="bg-gray-50 rounded-lg py-3">
						<span class="block text-2xl font-bold text-gray-900">{Math.round(totals.calories)}</span
						>
						<span class="block text-xs text-gray-500 uppercase tracking-wide"
							>{$_('home.order.calories')}</span
						>
					</div>
					<div class="bg-gray-50 rounded-lg py-3">
						<span class="block text-2xl font-bold text-gray-900">{Math.round(totals.protein)}g</span
						>
						<span class="block text-xs text-gray-500 uppercase tracking-wide"
							>{$_('home.order.protein')}</span
						>
					</div>
				</div>
			</div>
		{/if}

		<!-- Price + Place Order (only submit location on mobile) -->
		<div class="px-6 border-t border-gray-100 pt-4 shrink-0 safe-area-pb">
			<div class="flex items-center justify-between mb-4">
				<span class="text-gray-500">{$_('home.order.total')}</span>
				<span class="text-2xl font-bold text-gray-900">{formatPrice(totals.price)} COP</span>
			</div>
			<button
				type="button"
				onclick={handleMobileSubmit}
				disabled={!canSubmit || submitting}
				class="w-full py-4 bg-gray-900 text-white rounded-xl font-semibold hover:bg-gray-800 active:bg-gray-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
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

	<!-- Part C: Collapsed bottom bar -->
	<button
		type="button"
		onclick={openDrawer}
		aria-expanded={drawerOpen}
		aria-haspopup="dialog"
		class="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-3 safe-area-pb text-left z-59"
	>
		{#if selectedBowlSize}
			<div class="mb-2">
				<div class="flex items-center justify-between text-xs mb-1">
					<span class="text-gray-500">{$_('home.order.capacity')}</span>
					<span class="font-medium {isOverCapacity ? 'text-red-600' : 'text-gray-700'}">
						{totals.weight}g / {selectedBowlSize}g
					</span>
				</div>
				<div class="h-1.5 bg-gray-100 rounded-full overflow-hidden">
					<div
						class="h-full rounded-full transition-all duration-300 {isOverCapacity
							? 'bg-red-500'
							: 'bg-gray-900'}"
						style="width: {Math.min(capacityUsed, 100)}%"
					></div>
				</div>
				{#if isOverCapacity}
					<p class="text-xs text-red-600 mt-0.5">
						{$_('home.order.overCapacity', {
							values: { amount: totals.weight - selectedBowlSize }
						})}
					</p>
				{/if}
			</div>
		{/if}
		<div class="flex items-center justify-between gap-4">
			<div>
				<span class="block text-xs text-gray-500">
					{$_('home.order.items', { values: { count: selectedList.length } })}
				</span>
				<span class="block text-lg font-bold text-gray-900">{formatPrice(totals.price)} COP</span>
			</div>
			<div class="flex items-center gap-1.5 text-gray-500 text-sm font-medium shrink-0">
				<span>{$_('home.order.view')}</span>
				<svg
					class="w-4 h-4 transition-transform duration-200 {drawerOpen ? 'rotate-180' : ''}"
					fill="none"
					stroke="currentColor"
					viewBox="0 0 24 24"
				>
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />
				</svg>
			</div>
		</div>
	</button>
</div>

<style>
	.safe-area-pb {
		padding-bottom: max(0.75rem, env(safe-area-inset-bottom));
	}

	/* Drawer panel: GPU-composited animation for Android perf */
	.drawer-panel {
		transition: transform 300ms cubic-bezier(0.32, 0.72, 0, 1);
		will-change: transform;
		backface-visibility: hidden;
		-webkit-backface-visibility: hidden;
		overscroll-behavior: contain;
	}

	/* When dragging, suppress CSS transition so it follows finger */
	.drawer-panel.dragging {
		transition: none;
	}

	.drawer-backdrop {
		opacity: 0;
		pointer-events: none;
		transition: opacity 250ms ease;
		touch-action: none;
	}
	.drawer-backdrop.open {
		opacity: 1;
		pointer-events: auto;
	}
</style>
