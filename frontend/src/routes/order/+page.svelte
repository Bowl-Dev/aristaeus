<script lang="ts">
	// Wompi redirects here with ?c=<checkoutId>&id=<transactionId>. Display only: the
	// webhook is the source of truth, so this page just polls the checkout's status.
	import { onMount } from 'svelte';
	import { _ } from 'svelte-i18n';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { getCheckoutStatus, ApiError } from '$lib/api/client';
	import type { CheckoutStatusResponse } from '$lib/types';
	import Button from '$lib/components/atoms/Button.svelte';

	const POLL_MS = 2000;
	const MAX_POLLS = 30; // ~60 s

	let checkoutId = $state<string | null>(null);
	let checkout = $state<CheckoutStatusResponse | null>(null);
	let notFound = $state(false);
	let polling = $state(true);
	let timer: ReturnType<typeof setTimeout> | undefined;

	async function poll(attempt: number) {
		try {
			checkout = await getCheckoutStatus(checkoutId!);
		} catch (e) {
			if (e instanceof ApiError && e.status === 404) {
				notFound = true;
				polling = false;
				return;
			}
			// Transient failure: keep trying within the same budget.
		}
		if (checkout?.paymentStatus !== 'awaiting_payment' && checkout) {
			polling = false;
		} else if (attempt + 1 < MAX_POLLS) {
			timer = setTimeout(() => poll(attempt + 1), POLL_MS);
		} else {
			polling = false;
		}
	}

	function startPolling() {
		clearTimeout(timer);
		polling = true;
		poll(0);
	}

	onMount(() => {
		checkoutId = new URLSearchParams(window.location.search).get('c');
		if (checkoutId) startPolling();
		else {
			notFound = true;
			polling = false;
		}
		return () => clearTimeout(timer);
	});

	// Which copy block (order.<state>.*) to show.
	const view = $derived(
		notFound || (!polling && !checkout)
			? 'notFound'
			: checkout?.paymentStatus === 'paid'
				? 'paid'
				: checkout?.paymentStatus === 'payment_failed'
					? 'failed'
					: 'pending'
	);

	const dotClass: Record<string, string> = {
		paid: 'bg-green-400',
		failed: 'bg-red-500',
		pending: 'bg-amber-400'
	};
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
				{#if view === 'paid'}
					<polyline points="20 6 9 17 4 12" />
				{:else if view === 'pending'}
					<circle cx="12" cy="12" r="9" />
					<polyline points="12 7 12 12 15 14" />
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

		{#if checkout && view !== 'notFound'}
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
						<span class="h-2 w-2 rounded-full {dotClass[view]}" aria-hidden="true"></span>
						{$_(`order.${view}.status`)}
					</dd>
				</div>
				{#if view === 'paid'}
					<div class="flex items-center justify-between px-5 py-4">
						<dt>{$_('order.eta')}</dt>
						<dd class="m-0 font-bold text-text-black">25 – 35 min</dd>
					</div>
				{/if}
			</dl>
		{/if}

		{#if view === 'pending' && !polling}
			<Button variant="link" size="md" onclick={startPolling}>{$_('order.refresh')}</Button>
		{/if}

		<Button fullWidth onclick={() => goto(resolve('/'))}>{$_('order.home')}</Button>
	</section>
</main>
