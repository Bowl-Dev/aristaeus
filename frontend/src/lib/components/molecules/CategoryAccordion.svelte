<script lang="ts">
	import type { Ingredient } from '$lib/types';
	import IngredientRow from './IngredientRow.svelte';

	interface Props {
		label: string;
		ingredients: Ingredient[];
		selectedItems: Map<number, number>;
		remaining: number;
		onAdd: (id: number) => void;
		onIncrease: (id: number) => void;
		onDecrease: (id: number) => void;
		onRemove: (id: number) => void;
	}

	let {
		label,
		ingredients,
		selectedItems,
		remaining,
		onAdd,
		onIncrease,
		onDecrease,
		onRemove
	}: Props = $props();

	let isOpen = $state(false);

	// Auto-open when something in this category gets selected
	$effect(() => {
		const hasSelection = ingredients.some((i) => (selectedItems.get(i.id) ?? 0) > 0);
		if (hasSelection && !isOpen) isOpen = true;
	});

	function toggle() {
		isOpen = !isOpen;
	}
</script>

<div class="overflow-hidden rounded-2xl border border-strokes bg-pure-white">
	<!-- Header row -->
	<button
		class="flex w-full cursor-pointer items-center justify-between border-none bg-pure-white px-5 py-4 text-left [-webkit-tap-highlight-color:transparent]"
		onclick={toggle}
		aria-expanded={isOpen}
	>
		<span class="text-sm font-bold uppercase tracking-[0.9px] text-text-black">{label}</span>
		<svg
			width="18"
			height="18"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="2.5"
			stroke-linecap="round"
			stroke-linejoin="round"
			class="shrink-0 text-text-muted transition-transform duration-200"
			style={isOpen ? 'transform: rotate(180deg)' : ''}
			aria-hidden="true"
		>
			<polyline points="6 9 12 15 18 9" />
		</svg>
	</button>

	{#if isOpen}
		<div class="flex flex-col gap-2 px-3 pb-3" role="list">
			{#each ingredients as ingredient (ingredient.id)}
				<IngredientRow
					{ingredient}
					quantity={selectedItems.get(ingredient.id) ?? 0}
					{remaining}
					onAdd={() => onAdd(ingredient.id)}
					onIncrease={() => onIncrease(ingredient.id)}
					onDecrease={() => onDecrease(ingredient.id)}
					onRemove={() => onRemove(ingredient.id)}
				/>
			{/each}
		</div>
	{/if}
</div>
