<script lang="ts">
	// Delivery navigates here with ?c=<checkoutId> once the checkout (and its pending
	// orders) exist. Fetches the checkout once to show its AG-#### number.
	import { onMount } from 'svelte';
	import { _, locale } from 'svelte-i18n';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { getCheckoutStatus } from '$lib/api/client';
	import type { CheckoutStatusResponse } from '$lib/types';
	import { formatPickupDate } from '$lib/utils/checkout';
	import { ALGRAMO_WHATSAPP } from '$lib/constants';
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

	const notFound = $derived(!checkout && !loading);
	const whatsappHref = $derived(
		`https://wa.me/${ALGRAMO_WHATSAPP}?text=${encodeURIComponent(
			checkout
				? $_('order.whatsappMessage', { values: { number: checkout.orderNumber } })
				: $_('order.whatsappMessageGeneric')
		)}`
	);
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
				{#if notFound}
					<line x1="18" y1="6" x2="6" y2="18" />
					<line x1="6" y1="6" x2="18" y2="18" />
				{:else}
					<polyline points="20 6 9 17 4 12" />
				{/if}
			</svg>
		</div>
		<p class="m-0 text-xs font-semibold uppercase tracking-[0.15em] text-light-green">
			{$_(notFound ? 'order.notFound.eyebrow' : 'order.received.eyebrow')}
		</p>
		{#if checkout}
			<h1 class="m-0 text-[28px] font-bold leading-tight text-pure-white">
				AG-{checkout.orderNumber}
			</h1>
		{:else if notFound}
			<h1 class="m-0 max-w-[16rem] text-[28px] font-bold leading-tight text-pure-white">
				{$_('order.notFound.title')}
			</h1>
		{/if}
	</header>

	<section class="mx-auto flex w-full max-w-md flex-col gap-6 px-6 py-8">
		{#if notFound}
			<p class="m-0 text-center text-sm leading-6 text-text-muted">
				{$_('order.notFound.message')}
			</p>
		{/if}

		{#if checkout}
			<dl class="m-0 flex flex-col divide-y divide-strokes rounded-2xl bg-warm-beige text-sm">
				{#if checkout.pickup}
					<div class="flex flex-col gap-1 px-5 py-4">
						<dt class="text-xs text-text-muted">{$_('order.pickupPoint')}</dt>
						<dd class="m-0 font-bold text-text-black">
							{checkout.pickup.name} · {checkout.pickup.location}
						</dd>
					</div>
					<div class="flex flex-col gap-1 px-5 py-4">
						<dt class="text-xs text-text-muted">{$_('order.pickupDate')}</dt>
						<dd class="m-0 font-bold text-text-black">
							{formatPickupDate(checkout.pickup.date, $locale ?? 'es')} · {checkout.pickup.hours}
						</dd>
					</div>
				{:else}
					<div class="flex flex-col gap-1 px-5 py-4">
						<dt class="text-xs text-text-muted">{$_('order.eta')}</dt>
						<dd class="m-0 font-bold text-text-black">25 – 35 min</dd>
					</div>
				{/if}
			</dl>
			{#if checkout.pickup}
				<p class="m-0 text-center text-sm font-semibold text-dark-green">
					{$_('pickup.payNote')}
				</p>
			{/if}
		{/if}

		<div class="flex flex-col gap-3">
			<Button fullWidth onclick={() => goto(resolve('/'))}>{$_('order.home')}</Button>
			<!-- External wa.me link, not app navigation. -->
			<!-- eslint-disable svelte/no-navigation-without-resolve -->
			<a
				href={whatsappHref}
				target="_blank"
				rel="noopener noreferrer"
				class="inline-flex w-full items-center justify-center gap-2 rounded-full bg-whatsapp px-6 py-4 text-sm font-bold text-pure-white no-underline transition-all duration-200 hover:opacity-95 active:scale-[0.97]"
			>
				<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
					<path
						d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"
					/>
				</svg>
				{$_('order.whatsapp')}
			</a>
			<!-- eslint-enable svelte/no-navigation-without-resolve -->
		</div>
	</section>
</main>
