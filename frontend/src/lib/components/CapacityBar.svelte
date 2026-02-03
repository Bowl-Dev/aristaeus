<script lang="ts">
	import type { BowlSize } from '$lib/types';
	import { _ } from 'svelte-i18n';

	// Props
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

<div class="capacity-section">
	<div class="capacity-header">
		<span class="capacity-label">{$_('capacity.title')}</span>
		<span class="capacity-values">
			{currentWeight.toFixed(0)}g / {bowlSize}g
		</span>
	</div>
	<div class="capacity-bar">
		<div class="capacity-fill" class:warning class:exceeded style="width: {percentage}%"></div>
	</div>
	{#if exceeded}
		<p class="capacity-message error">
			{$_('capacity.exceeded', { values: { amount: Math.abs(remaining).toFixed(0) } })}
		</p>
	{:else if warning}
		<p class="capacity-message warning">
			{$_('capacity.onlyRemaining', { values: { amount: remaining.toFixed(0) } })}
		</p>
	{:else}
		<p class="capacity-message">
			{$_('capacity.remaining', { values: { amount: remaining.toFixed(0) } })}
		</p>
	{/if}
</div>

<style>
	.capacity-section {
		margin-bottom: 1.5rem;
		padding: 1rem;
		background: #f8f9fa;
		border-radius: 8px;
	}

	.capacity-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 0.75rem;
	}

	.capacity-label {
		font-weight: 600;
		color: #34495e;
	}

	.capacity-values {
		font-weight: 700;
		color: #16a085;
	}

	.capacity-bar {
		width: 100%;
		height: 24px;
		background: #ecf0f1;
		border-radius: 12px;
		overflow: hidden;
		margin-bottom: 0.5rem;
	}

	.capacity-fill {
		height: 100%;
		background: #16a085;
		transition: all 0.3s ease;
		border-radius: 12px;
	}

	.capacity-fill.warning {
		background: #f39c12;
	}

	.capacity-fill.exceeded {
		background: #e74c3c;
	}

	.capacity-message {
		margin: 0;
		font-size: 0.875rem;
		font-weight: 600;
		text-align: center;
		color: #7f8c8d;
	}

	.capacity-message.warning {
		color: #f39c12;
	}

	.capacity-message.error {
		color: #e74c3c;
		font-size: 1rem;
	}
</style>
