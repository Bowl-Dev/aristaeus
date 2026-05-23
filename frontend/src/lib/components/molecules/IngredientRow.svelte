<script lang="ts">
	import type { Ingredient } from '$lib/types';

	interface Props {
		ingredient: Ingredient;
		quantity: number;
		remaining: number;
		onAdd: () => void;
		onIncrease: () => void;
		onDecrease: () => void;
		onRemove: () => void;
	}

	let { ingredient, quantity, remaining, onAdd, onIncrease, onDecrease, onRemove }: Props =
		$props();

	const isSelected = $derived(quantity > 0);
	const step = $derived(
		ingredient.category === 'dressing' || ingredient.category === 'topping' ? 5 : 10
	);

	// Disable add when there isn't room for even the minimum quantity
	const addDisabled = $derived(remaining < step);
	// Disable increase when there isn't room for another full step
	const increaseDisabled = $derived(remaining < step);

	// Nutritional chips — values shown are per 100g (as indicated by the info banner)
	const chips = $derived([
		`${Math.round(ingredient.caloriesPer100g)} cal`,
		`${Math.round(ingredient.proteinGPer100g)}g P`,
		`${Math.round(ingredient.carbsGPer100g)}g C`,
		`${Math.round(ingredient.fatGPer100g)}g G`
	]);

	const quantityLabel = $derived(`${quantity}g`);

	// ── Long-press state for the − button ──
	let longPressTimer: ReturnType<typeof setTimeout> | null = null;
	let longPressTriggered = $state(false);

	function startLongPress() {
		longPressTriggered = false;
		longPressTimer = setTimeout(() => {
			longPressTriggered = true;
			onRemove();
		}, 500);
	}

	function cancelLongPress() {
		if (longPressTimer !== null) {
			clearTimeout(longPressTimer);
			longPressTimer = null;
		}
	}

	function handleDecreaseClick() {
		if (longPressTriggered) {
			// Long-press already fired onRemove — swallow the click
			longPressTriggered = false;
			return;
		}
		onDecrease();
	}

	// ── Image with SVG fallback ──
	let imgError = $state(false);
</script>

<div
	class="flex items-stretch overflow-hidden rounded-2xl {isSelected
		? 'bg-light-green/10'
		: 'bg-accent-gray'}"
	role="listitem"
>
	<!-- Ingredient image: fixed-width square panel, height driven by right content via items-stretch -->
	<div
		class="flex w-20 shrink-0 items-center justify-center overflow-hidden bg-pure-white text-text-muted"
		aria-hidden="true"
	>
		{#if !imgError}
			<img
				src="/Ingridients/{ingredient.name}.png"
				alt={ingredient.nameEs}
				class="h-full w-full object-cover"
				onerror={() => (imgError = true)}
			/>
		{:else}
			<svg
				width="28"
				height="28"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="1.5"
				stroke-linecap="round"
				stroke-linejoin="round"
			>
				<rect x="3" y="3" width="18" height="18" rx="2" />
				<circle cx="8.5" cy="8.5" r="1.5" />
				<path d="M21 15l-5-5L5 21" />
			</svg>
		{/if}
	</div>

	<!-- Name + nutritional chips -->
	<div class="flex min-w-0 flex-1 flex-col gap-1 p-3">
		<span class="truncate text-sm font-semibold text-text-black">{ingredient.nameEs}</span>
		<div class="flex justify-between">
			{#each chips as chip (chip)}
				<span class="text-xs text-text-muted">{chip}</span>
			{/each}
		</div>

		{#if isSelected}
			<!-- Stepper: below chips, fills full width -->
			<div class="mt-1 flex items-center justify-between">
				<button
					class="flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-full border border-strokes bg-pure-white text-text-black transition-colors duration-150 hover:bg-accent-gray active:scale-95 [-webkit-tap-highlight-color:transparent]"
					onclick={handleDecreaseClick}
					onpointerdown={startLongPress}
					onpointerup={cancelLongPress}
					onpointerleave={cancelLongPress}
					onpointercancel={cancelLongPress}
					aria-label={`Disminuir ${ingredient.nameEs}`}
				>
					<svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
						<line
							x1="2"
							y1="6"
							x2="10"
							y2="6"
							stroke="currentColor"
							stroke-width="2"
							stroke-linecap="round"
						/>
					</svg>
				</button>
				<span class="min-w-[3rem] text-center text-sm font-bold text-text-black"
					>{quantityLabel}</span
				>
				<button
					class="flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-full border-none bg-dark-green text-light-green transition-colors duration-150 hover:opacity-90 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 [-webkit-tap-highlight-color:transparent]"
					onclick={onIncrease}
					disabled={increaseDisabled}
					aria-label={`Aumentar ${ingredient.nameEs}`}
				>
					<svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
						<line
							x1="6"
							y1="2"
							x2="6"
							y2="10"
							stroke="currentColor"
							stroke-width="2"
							stroke-linecap="round"
						/>
						<line
							x1="2"
							y1="6"
							x2="10"
							y2="6"
							stroke="currentColor"
							stroke-width="2"
							stroke-linecap="round"
						/>
					</svg>
				</button>
			</div>
		{:else}
			<!-- Add button: below chips, right-aligned -->
			<div class="mt-1 flex justify-end">
				<button
					class="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full border-none bg-dark-green text-light-green transition-colors duration-150 hover:opacity-90 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 [-webkit-tap-highlight-color:transparent]"
					onclick={onAdd}
					disabled={addDisabled}
					aria-label={`Agregar ${ingredient.nameEs}`}
				>
					<svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
						<line
							x1="8"
							y1="3"
							x2="8"
							y2="13"
							stroke="currentColor"
							stroke-width="2.2"
							stroke-linecap="round"
						/>
						<line
							x1="3"
							y1="8"
							x2="13"
							y2="8"
							stroke="currentColor"
							stroke-width="2.2"
							stroke-linecap="round"
						/>
					</svg>
				</button>
			</div>
		{/if}
	</div>
</div>
