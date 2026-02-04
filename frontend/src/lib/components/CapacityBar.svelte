<script lang="ts">
	import type { BowlSize } from '$lib/types';
	import { _ } from 'svelte-i18n';

	interface Props {
		currentWeight: number;
		bowlSize: BowlSize;
	}

	let { currentWeight, bowlSize }: Props = $props();

	const remaining = $derived(bowlSize - currentWeight);
	const exceeded = $derived(remaining < 0);
	const warning = $derived(remaining >= 0 && remaining < 50);
	const percentage = $derived(Math.min((currentWeight / bowlSize) * 100, 100));
</script>

<div
	class="card bg-surface-200 dark:bg-surface-700 border border-surface-300 dark:border-surface-600 rounded-xl p-4 mb-6"
>
	<div class="flex justify-between items-center mb-3">
		<span class="font-semibold">{$_('capacity.title')}</span>
		<span class="font-bold text-primary-500">
			{currentWeight.toFixed(0)}g / {bowlSize}g
		</span>
	</div>
	<div class="w-full h-6 bg-surface-300 dark:bg-surface-600 rounded-full overflow-hidden mb-2">
		<div
			class="h-full rounded-full transition-all duration-300 {exceeded
				? 'bg-error-500'
				: warning
					? 'bg-warning-500'
					: 'bg-primary-500'}"
			style="width: {percentage}%"
		></div>
	</div>
	{#if exceeded}
		<p class="text-error-500 font-semibold text-center">
			{$_('capacity.exceeded', { values: { amount: Math.abs(remaining).toFixed(0) } })}
		</p>
	{:else if warning}
		<p class="text-warning-500 font-semibold text-center">
			{$_('capacity.onlyRemaining', { values: { amount: remaining.toFixed(0) } })}
		</p>
	{:else}
		<p class="text-surface-500 font-semibold text-center">
			{$_('capacity.remaining', { values: { amount: remaining.toFixed(0) } })}
		</p>
	{/if}
</div>
