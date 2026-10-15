<script lang="ts">
	import { _ } from 'svelte-i18n';
	import type { CheckoutQuote } from '$lib/types';
	import { formatCOP } from '$lib/utils/bowl';
	import Card from '../molecules/Card.svelte';
	import DeliveryFeeInfo from '../molecules/DeliveryFeeInfo.svelte';

	let {
		lines,
		quote,
		subtotal,
		hint
	}: {
		/** One row per cart bowl; amounts are display-only client prices. */
		lines: { label: string; amount: number }[];
		/** Server pricing. While null, the fee rows show `hint` and TOTAL is blank. */
		quote: CheckoutQuote | null;
		/** Client subtotal, shown until a quote exists. */
		subtotal: number;
		hint: string;
	} = $props();

	const coupon = $derived(quote && quote.discount > 0 ? quote.coupon : null);
	// Free shipping is shown on the shipping row itself, not as a second −amount.
	const freeShipping = $derived(coupon?.type === 'free_shipping');
	let feeInfoOpen = $state(false);
</script>

<Card gap="gap-2">
	<p class="m-0 text-sm font-bold uppercase tracking-[0.5px] text-text-black">
		{$_('delivery.summary.title')}
	</p>
	{#each lines as line, i (i)}
		<div class="flex items-center justify-between">
			<span class="text-sm text-text-muted">{line.label}</span>
			<span class="text-sm font-semibold text-text-black">{formatCOP(line.amount)}</span>
		</div>
	{/each}

	<div class="mt-1 flex flex-col gap-2 border-t border-strokes pt-2">
		<div class="flex items-center justify-between">
			<span class="text-sm text-text-muted">{$_('delivery.summary.subtotal')}</span>
			<span class="text-sm font-semibold text-text-black">
				{formatCOP(quote?.subtotal ?? subtotal)}
			</span>
		</div>
		{#if quote && coupon}
			<div class="flex items-center justify-between gap-2" data-testid="coupon-row">
				<span class="flex min-w-0 items-center gap-1.5">
					<span
						class="rounded-full bg-warm-beige px-2 py-0.5 text-xs font-bold tracking-[0.5px] text-dark-green"
					>
						{coupon.code}
					</span>
					<span class="text-sm font-semibold text-dark-green">
						{$_(`coupon.row.${coupon.type}`, { values: { value: coupon.value ?? 0 } })}
					</span>
				</span>
				{#if !freeShipping}
					<span class="text-sm font-semibold text-dark-green">−{formatCOP(quote.discount)}</span>
				{/if}
			</div>
		{/if}
		<div class="flex items-center justify-between">
			<span class="flex items-center text-sm text-text-muted">
				{$_('delivery.summary.shipping')}
				<button
					type="button"
					class="-my-[14px] cursor-pointer border-none bg-transparent p-[14px] text-dark-green"
					aria-label={$_('delivery.feeInfo.open')}
					onclick={() => (feeInfoOpen = true)}
				>
					<svg
						width="16"
						height="16"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						aria-hidden="true"
					>
						<circle cx="12" cy="12" r="10" />
						<line x1="12" y1="16" x2="12" y2="12" />
						<line x1="12" y1="8" x2="12.01" y2="8" />
					</svg>
				</button>
			</span>
			{#if !quote}
				<span class="text-xs text-text-muted">{hint}</span>
			{:else if freeShipping}
				<span class="text-sm" data-testid="free-shipping">
					<s class="text-text-muted">{formatCOP(quote.deliveryFee)}</s>
					<span class="font-bold text-dark-green">{$_('delivery.summary.free')}</span>
				</span>
			{:else}
				<span class="text-sm font-semibold text-text-black">{formatCOP(quote.deliveryFee)}</span>
			{/if}
		</div>
		{#if quote}
			<p class="m-0 text-xs leading-5 text-text-muted">
				{$_('delivery.feeInfo.note')}
				<button
					type="button"
					class="cursor-pointer border-none bg-transparent p-0 text-xs font-bold text-dark-green underline underline-offset-2"
					onclick={() => (feeInfoOpen = true)}
				>
					{$_('delivery.feeInfo.learnMore')}
				</button>
			</p>
		{/if}
		<div class="flex items-center justify-between">
			<span class="text-sm text-text-muted">{$_('delivery.summary.service')}</span>
			{#if quote}
				<span class="text-sm font-semibold text-text-black">{formatCOP(quote.serviceFee)}</span>
			{:else}
				<span class="text-xs text-text-muted">{hint}</span>
			{/if}
		</div>
	</div>

	<div class="mt-1 flex items-end justify-between border-t border-strokes pt-3">
		<span class="text-lg font-bold uppercase tracking-[0.5px] text-text-black">
			{$_('delivery.summary.total')}
		</span>
		<span class="flex flex-col items-end">
			{#if quote && coupon}
				<s class="text-xs text-text-muted" data-testid="pre-discount-total">
					{formatCOP(quote.totalBeforeDiscount)}
				</s>
			{/if}
			<span class="text-2xl font-bold text-dark-green">
				{quote ? formatCOP(quote.total) : '—'}
			</span>
		</span>
	</div>
</Card>

{#if feeInfoOpen}
	<DeliveryFeeInfo onDismiss={() => (feeInfoOpen = false)} />
{/if}
