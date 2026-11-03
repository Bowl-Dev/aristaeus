<script lang="ts">
	import { _ } from 'svelte-i18n';
	import type { PickupPoint } from '$lib/types';
	import AppScreen from './templates/AppScreen.svelte';
	import Button from './atoms/Button.svelte';

	let {
		points,
		cartCount,
		selected = $bindable(null),
		onBack,
		onContinue
	}: {
		/** Active pickup points only. */
		points: PickupPoint[];
		cartCount?: number;
		/** 'delivery', a pickup point id, or nothing chosen yet. */
		selected?: 'delivery' | number | null;
		onBack: () => void;
		onContinue: () => void;
	} = $props();

	const pickupSelected = $derived(typeof selected === 'number');
	const option = 'flex cursor-pointer flex-col gap-3 rounded-2xl border bg-pure-white p-4';
	const icon =
		'flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-warm-beige text-2xl';
</script>

<AppScreen {onBack} {cartCount} fill>
	{#snippet heading()}
		<div class="flex flex-col gap-1 px-5 pb-4 pt-6">
			<p class="m-0 text-xs font-bold uppercase tracking-[1.2px] text-dark-green">
				{$_('fulfillment.step')}
			</p>
			<h1 class="m-0 text-[24px] font-bold text-text-black">{$_('fulfillment.title')}</h1>
		</div>
	{/snippet}

	<div class="flex flex-1 flex-col gap-4 overflow-y-auto px-5 py-4">
		<label class="{option} {selected === 'delivery' ? 'border-dark-green' : 'border-strokes'}">
			<span class="flex items-start gap-3">
				<span class={icon} aria-hidden="true">🛵</span>
				<span class="flex flex-1 flex-col gap-1">
					<span class="text-base font-bold text-text-black">{$_('fulfillment.delivery.title')}</span
					>
					<span class="text-sm text-text-muted">{$_('fulfillment.delivery.description')}</span>
				</span>
				<input
					type="radio"
					name="fulfillment"
					value="delivery"
					class="h-5 w-5 text-dark-green focus:ring-dark-green"
					bind:group={selected}
				/>
			</span>
		</label>

		<div class="{option} {pickupSelected ? 'border-dark-green' : 'border-strokes'}">
			<span class="flex items-start gap-3">
				<span class={icon} aria-hidden="true">📍</span>
				<span class="flex flex-1 flex-col items-start gap-1">
					<span class="text-base font-bold text-text-black">{$_('fulfillment.pickup.title')}</span>
					<span class="text-sm text-text-muted">{$_('fulfillment.pickup.description')}</span>
					<span class="rounded-full bg-warm-beige px-2 py-0.5 text-xs font-bold text-dark-green">
						🎓 {$_('fulfillment.pickup.freeShipping')}
					</span>
				</span>
			</span>
			{#each points as point (point.id)}
				<label
					class="flex cursor-pointer items-center gap-3 rounded-xl border p-3 {selected === point.id
						? 'border-dark-green bg-white-green'
						: 'border-strokes'}"
				>
					<span class="flex flex-1 flex-col">
						<span class="text-sm font-bold text-dark-green">{point.name}</span>
						<span class="text-xs text-text-black">{point.location}</span>
						<span class="text-xs text-text-muted">{point.hours}</span>
					</span>
					<input
						type="radio"
						name="fulfillment"
						value={point.id}
						class="h-5 w-5 text-dark-green focus:ring-dark-green"
						bind:group={selected}
					/>
				</label>
			{/each}
		</div>
	</div>

	<div class="px-5 pb-10 pt-3">
		<Button fullWidth disabled={selected === null} onclick={onContinue}>
			{$_('fulfillment.continue')}
		</Button>
	</div>
</AppScreen>
