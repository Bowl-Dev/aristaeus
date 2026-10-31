<script lang="ts">
	import { onMount } from 'svelte';
	import { _, locale } from 'svelte-i18n';
	import type { Ingredient, CheckoutQuote, CouponRejection, PickupPoint } from '$lib/types';
	import { formatCOP } from '$lib/utils/bowl';
	import type { BowlSnapshot } from '$lib/utils/cart';
	import {
		summaryLines,
		toCheckoutBowls,
		rejectionMessage,
		formatPickupDate
	} from '$lib/utils/checkout';
	import { getCheckoutQuote, createCheckout, ApiError } from '$lib/api/client';
	import { resolve } from '$app/paths';
	import { goto } from '$app/navigation';
	import AppScreen from './templates/AppScreen.svelte';
	import FormInput from './molecules/FormInput.svelte';
	import CouponField from './molecules/CouponField.svelte';
	import CheckoutSummary from './organisms/CheckoutSummary.svelte';

	let {
		ingredients,
		bowls,
		point,
		cartCount,
		onBack
	}: {
		ingredients: Ingredient[];
		bowls: BowlSnapshot[];
		point: PickupPoint;
		cartCount?: number;
		onBack: () => void;
	} = $props();

	let name = $state('');
	let phone = $state('');
	let submitting = $state(false);
	let formError = $state<string | null>(null);

	// Same quote/coupon flow as Delivery, minus the address: the destination is
	// fixed for this screen, so every quote is fresh.
	let couponInput = $state('');
	let couponCode = $state<string | null>(null);
	let couponError = $state<string | null>(null);
	let quote = $state<CheckoutQuote | null>(null);
	let quoting = $state(false);
	let quoteSeq = 0;
	const appliedCoupon = $derived(quote?.coupon ?? null);

	let errors = $state<{ name?: string; phone?: string }>({});
	let hasSubmitted = $state(false);

	function validate(): boolean {
		const next: typeof errors = {};
		if (!name.trim()) next.name = $_('delivery.errors.nameRequired');
		if (phone.length !== 10) next.phone = $_('delivery.errors.phoneInvalid');
		errors = next;
		return Object.keys(next).length === 0;
	}

	$effect(() => {
		void name;
		void phone;
		if (hasSubmitted) validate();
	});

	const lines = $derived(summaryLines(bowls, ingredients, $_));
	const clientSubtotal = $derived(lines.reduce((acc, l) => acc + l.amount, 0));
	const checkoutBowls = $derived(toCheckoutBowls(bowls));
	const pickupDate = $derived(
		quote?.pickupDate ? formatPickupDate(quote.pickupDate, $locale ?? 'es') : null
	);

	const isApiError = (e: unknown, status: number, message: string) =>
		e instanceof ApiError && e.status === status && e.message === message;

	async function requestQuote() {
		const seq = ++quoteSeq;
		quoting = true;
		try {
			const q = await getCheckoutQuote({
				pickupPointId: point.id,
				bowls: checkoutBowls,
				couponCode: couponCode ?? undefined,
				phone: phone.length === 10 ? phone : undefined
			});
			if (seq !== quoteSeq) return;
			quote = q;
			formError = null;
			if (q.couponRejection) {
				couponError = rejectionMessage(q.couponRejection, $_);
				couponCode = null;
			}
		} catch (e) {
			if (seq !== quoteSeq) return;
			quote = null;
			formError = isApiError(e, 400, 'Pickup point not available')
				? $_('pickup.errors.unavailable')
				: $_('delivery.errors.quoteFailed');
		} finally {
			if (seq === quoteSeq) quoting = false;
		}
	}

	onMount(requestQuote);

	function applyCoupon() {
		couponError = null;
		couponCode = couponInput.trim();
		requestQuote();
	}

	function onCouponEdit() {
		couponError = null;
		if (couponCode !== null) {
			couponCode = null;
			requestQuote();
		}
	}

	const couponSuccess = $derived(
		appliedCoupon && quote
			? $_(`coupon.applied.${appliedCoupon.type}`, {
					values: { value: appliedCoupon.value ?? 0, amount: formatCOP(quote.discount) }
				})
			: undefined
	);

	// Reused on every retry so a lost response can't place a second order.
	const checkoutId = crypto.randomUUID();

	async function handleSubmit() {
		hasSubmitted = true;
		if (!validate() || !quote) return;

		submitting = true;
		formError = null;
		const trimmedPhone = phone.trim();
		try {
			const checkout = await createCheckout({
				checkoutId,
				pickupPointId: point.id,
				bowls: checkoutBowls,
				couponCode: appliedCoupon?.code,
				phone: trimmedPhone,
				customer: { name: name.trim(), phone: trimmedPhone }
			});
			// eslint-disable-next-line svelte/no-navigation-without-resolve
			await goto(resolve('/order') + '?c=' + encodeURIComponent(checkout.checkoutId));
		} catch (e) {
			submitting = false;
			if (isApiError(e, 409, 'coupon_rejected')) {
				couponError = rejectionMessage(
					(e as ApiError).details as { reason: CouponRejection; minBowls?: number },
					$_
				);
				couponCode = null;
				requestQuote();
			} else if (isApiError(e, 503, 'ordersPaused')) {
				formError = $_('delivery.errors.ordersPaused');
			} else if (isApiError(e, 400, 'Pickup point not available')) {
				formError = $_('pickup.errors.unavailable');
			} else {
				formError = $_('delivery.error');
			}
		}
	}
</script>

<AppScreen {onBack} {cartCount} fill>
	{#snippet heading()}
		<div class="flex flex-col gap-1 px-5 pb-4 pt-6">
			<p class="m-0 text-xs font-bold uppercase tracking-[1.2px] text-dark-green">
				{$_('pickup.step')}
			</p>
			<h1 class="m-0 text-[24px] font-bold text-text-black">{$_('pickup.title')}</h1>
		</div>
	{/snippet}

	<div class="flex flex-1 flex-col gap-4 overflow-y-auto px-5 py-4">
		<div class="flex flex-col gap-1 rounded-2xl bg-dark-green p-5">
			<p class="m-0 text-xs font-bold uppercase tracking-[1.2px] text-light-green">
				{$_('pickup.pointLabel')}
			</p>
			<p class="m-0 text-xl font-bold text-pure-white">{point.name}</p>
			<p class="m-0 text-sm text-pure-white/80">{point.location}</p>
			<p class="m-0 mt-2 text-sm font-semibold text-light-green">🕐 {point.hours}</p>
		</div>

		<div class="flex gap-3 rounded-2xl bg-warm-beige p-4">
			<span class="text-xl" aria-hidden="true">📅</span>
			<div class="flex flex-col gap-1">
				<p class="m-0 text-sm font-bold text-text-black">
					{pickupDate
						? $_('pickup.dateTitle', { values: { date: pickupDate } })
						: $_('pickup.nextDay')}
				</p>
				<p class="m-0 text-sm leading-5 text-text-muted">{$_('pickup.dateBody')}</p>
			</div>
		</div>

		<FormInput
			id="pickup-name"
			label={$_('delivery.form.name.label')}
			bind:value={name}
			placeholder={$_('delivery.form.name.placeholder')}
			error={errors.name}
			required
		/>

		<FormInput
			id="pickup-phone"
			type="numeric"
			label={$_('delivery.form.phone.label')}
			bind:value={phone}
			placeholder={$_('delivery.form.phone.placeholder')}
			error={errors.phone}
			onblur={() => couponCode !== null && requestQuote()}
			required
		/>

		<CouponField
			bind:value={couponInput}
			pending={quoting && couponCode !== null}
			success={couponSuccess}
			error={couponError ?? undefined}
			onApply={applyCoupon}
			onEdit={onCouponEdit}
		/>

		<CheckoutSummary
			{lines}
			{quote}
			subtotal={clientSubtotal}
			hint={$_('delivery.summary.quoting')}
			note={$_('pickup.payNote')}
			pickup
		/>
	</div>

	<div class="flex flex-col gap-3 px-5 pb-10 pt-3">
		{#if formError}
			<p class="m-0 text-center text-sm text-red-500" role="alert">{formError}</p>
		{/if}

		<button
			type="button"
			disabled={submitting || quoting || !quote || !name.trim() || phone.length !== 10}
			onclick={handleSubmit}
			class="w-full cursor-pointer rounded-full border-none bg-dark-green px-6 py-4 text-sm font-bold text-light-green transition-all duration-200 hover:opacity-95 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50 [-webkit-tap-highlight-color:transparent]"
		>
			{#if submitting}
				{$_('delivery.confirming')}
			{:else if quote}
				{$_('pickup.confirm', { values: { price: formatCOP(quote.total) } })}
			{:else}
				{$_('pickup.confirmNoPrice')}
			{/if}
		</button>

		<p class="m-0 px-2 text-center text-xs text-text-muted">
			{$_('footer.implicitConsent')}
			<a href={resolve('/privacy')} class="underline underline-offset-2 hover:text-text-black">
				{$_('footer.privacyPolicy')}
			</a>
		</p>
	</div>
</AppScreen>
