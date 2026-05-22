<script lang="ts">
	import { untrack } from 'svelte';
	import type { Ingredient } from '$lib/types';
	import IngredientRow from './IngredientRow.svelte';

	interface Props {
		label: string;
		ingredients: Ingredient[];
		selectedItems: ReadonlyMap<number, number>;
		remaining: number;
		defaultOpen?: boolean;
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
		defaultOpen = false,
		onAdd,
		onIncrease,
		onDecrease,
		onRemove
	}: Props = $props();

	let isOpen = $state(untrack(() => defaultOpen));

	function toggle() {
		isOpen = !isOpen;
	}
</script>

<div class="overflow-hidden rounded-2xl border border-strokes bg-pure-white">
	<!-- Header row -->
	<button
		class="flex w-full cursor-pointer items-center justify-between border-none bg-pure-white px-6 py-5 text-left [-webkit-tap-highlight-color:transparent]"
		onclick={toggle}
		aria-expanded={isOpen}
	>
		<span class="text-lg font-bold leading-7 text-text-black">{label}</span>
		<svg
			width="20"
			height="20"
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
		<div class="flex flex-col gap-3 px-3 pb-8" role="list">
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
