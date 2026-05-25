<script lang="ts">
	import { _ } from 'svelte-i18n';

	type Surface = 'card-dark' | 'flush-dark';

	let {
		calories,
		protein,
		carbs,
		fat,
		surface = 'card-dark',
		ariaLabel
	}: {
		calories: number;
		protein: number;
		carbs: number;
		fat: number;
		surface?: Surface;
		ariaLabel?: string;
	} = $props();

	const chips = $derived([
		{ label: $_('menu.card.calories'), value: `${calories}` },
		{ label: $_('menu.card.protein'), value: `${protein}g` },
		{ label: $_('menu.card.carbs'), value: `${carbs}g` },
		{ label: $_('menu.card.fat'), value: `${fat}g` }
	]);

	const wrapperClass = $derived(
		surface === 'card-dark'
			? 'grid grid-cols-4 gap-2 rounded-xl bg-text-black p-3'
			: 'grid grid-cols-4 gap-3'
	);
</script>

<dl class={wrapperClass} aria-label={ariaLabel}>
	{#each chips as chip (chip.label)}
		<div class="flex flex-col items-center gap-0.5">
			<dt class="text-[9px] font-medium uppercase tracking-[0.6px] text-pure-white/60">
				{chip.label}
			</dt>
			<dd class="m-0 text-sm font-bold text-pure-white">{chip.value}</dd>
		</div>
	{/each}
</dl>
