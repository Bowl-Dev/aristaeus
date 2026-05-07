<script lang="ts">
	import { _ } from 'svelte-i18n';

	let {
		calories,
		protein,
		carbs,
		fat
	}: {
		calories: number;
		protein: number;
		carbs: number;
		fat: number;
	} = $props();

	const columns = $derived([
		{ label: $_('menu.card.calories'), value: `${calories}` },
		{ label: $_('menu.card.protein'), value: `${protein}g` },
		{ label: $_('menu.card.carbs'), value: `${carbs}g` },
		{ label: $_('menu.card.fat'), value: `${fat}g` }
	]);
</script>

<div
	class="flex items-center justify-center gap-3 rounded-[14px] bg-text-black p-2 text-center text-pure-white"
>
	{#each columns as col (col.label)}
		<div class="flex h-[44px] w-[53px] flex-col items-center justify-center whitespace-nowrap">
			<span class="text-[10px] font-medium uppercase leading-4 tracking-[0.6px]">
				{col.label}
			</span>
			<span class="text-base font-semibold leading-6">{col.value}</span>
		</div>
	{/each}
</div>
