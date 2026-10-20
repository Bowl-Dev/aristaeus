<script lang="ts">
	// Delivery navigates here with ?c=<checkoutId> once the checkout (and its pending
	// orders) exist. Fetches the checkout once to show its AG-#### number.
	import { onMount } from 'svelte';
	import { _ } from 'svelte-i18n';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { getCheckoutStatus } from '$lib/api/client';
	import type { CheckoutStatusResponse } from '$lib/types';
	import Button from '$lib/components/atoms/Button.svelte';

	let checkout = $state<CheckoutStatusResponse | null>(null);
	let loading = $state(true);

	onMount(async () => {
		const checkoutId = new URLSearchParams(window.location.search).get('c');
		try {
			if (checkoutId) checkout = await getCheckoutStatus(checkoutId);
		} catch {
			// 404 or network: fall through to the not-found copy.
		}
		loading = false;
	});

	// Which copy block (order.<state>.*) to show.
	const view = $derived(checkout || loading ? 'received' : 'notFound');
</script>

<main class="flex min-h-svh flex-col bg-white-green">
	<header class="flex flex-col items-center gap-3 bg-dark-green px-6 pb-9 pt-8 text-center">
		<div
			class="flex h-16 w-16 items-center justify-center rounded-full bg-light-green text-dark-green"
			aria-hidden="true"
		>
			<svg
				width="28"
				height="28"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="3"
				stroke-linecap="round"
				stroke-linejoin="round"
			>
				{#if view === 'received'}
					<polyline points="20 6 9 17 4 12" />
				{:else}
					<line x1="18" y1="6" x2="6" y2="18" />
					<line x1="6" y1="6" x2="18" y2="18" />
				{/if}
			</svg>
		</div>
		<p class="m-0 text-xs font-semibold uppercase tracking-[0.15em] text-light-green">
			{$_(`order.${view}.eyebrow`)}
		</p>
		<h1 class="m-0 max-w-[16rem] text-[28px] font-bold leading-tight text-pure-white">
			{$_(`order.${view}.title`)}
		</h1>
	</header>

	<section class="mx-auto flex w-full max-w-md flex-col gap-6 px-6 py-8">
		<p class="m-0 text-center text-sm leading-6 text-text-muted">
			{$_(`order.${view}.message`)}
		</p>

		{#if checkout}
			<dl
				class="m-0 flex flex-col divide-y divide-strokes rounded-2xl bg-warm-beige text-sm text-text-muted"
			>
				<div class="flex items-center justify-between px-5 py-4">
					<dt>{$_('order.number')}</dt>
					<dd class="m-0 font-bold text-dark-green">AG-{checkout.orderNumber}</dd>
				</div>
				<div class="flex items-center justify-between px-5 py-4">
					<dt>{$_('order.status')}</dt>
					<dd class="m-0 flex items-center gap-2 font-bold text-dark-green">
						<span class="h-2 w-2 rounded-full bg-green-400" aria-hidden="true"></span>
						{$_(`order.${view}.status`)}
					</dd>
				</div>
				<div class="flex items-center justify-between px-5 py-4">
					<dt>{$_('order.eta')}</dt>
					<dd class="m-0 font-bold text-text-black">25 – 35 min</dd>
				</div>
			</dl>
		{/if}

		<Button fullWidth onclick={() => goto(resolve('/'))}>{$_('order.home')}</Button>
	</section>
</main>
