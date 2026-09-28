<script lang="ts">
	import { _ } from 'svelte-i18n';
	import type { CheckoutQuote } from '$lib/types';
	import { formatCOP } from '$lib/utils/bowl';
	import Card from '../molecules/Card.svelte';

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
				<span class="text-sm font-semibold text-dark-green">−{formatCOP(quote.discount)}</span>
			</div>
		{/if}
		{#each [['shipping', quote?.deliveryFee], ['service', quote?.serviceFee]] as const as [key, amount] (key)}
			<div class="flex items-center justify-between">
				<span class="text-sm text-text-muted">{$_(`delivery.summary.${key}`)}</span>
				{#if amount === undefined}
					<span class="text-xs text-text-muted">{hint}</span>
				{:else}
					<span class="text-sm font-semibold text-text-black">{formatCOP(amount)}</span>
				{/if}
			</div>
		{/each}
	</div>

	<div class="mt-1 flex items-end justify-between border-t border-strokes pt-3">
		<span class="text-lg font-bold uppercase tracking-[0.5px] text-text-black">
			{$_('delivery.summary.total')}
		</span>
		<span class="flex flex-col items-end">
			{#if quote && coupon}
				<s class="text-xs text-text-muted" data-testid="pre-discount-total">
					{formatCOP(quote.total + quote.discount)}
				</s>
			{/if}
			<span class="text-2xl font-bold text-dark-green">
				{quote ? formatCOP(quote.total) : '—'}
			</span>
		</span>
	</div>
</Card>
