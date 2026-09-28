<script lang="ts">
	import { _ } from 'svelte-i18n';
	import type {
		Ingredient,
		BowlSize,
		CheckoutBowl,
		CheckoutQuote,
		CouponRejection
	} from '$lib/types';
	import { computeBowlTotals, bowlBasePrice, formatCOP } from '$lib/utils/bowl';
	import { CUTLERY_PRICE, roundToNearestCoin } from '$lib/types';
	import { getCheckoutQuote, createCheckout, ApiError } from '$lib/api/client';
	import { wompiCheckoutUrl } from '$lib/utils/wompi';
	import { resolve } from '$app/paths';
	import AppScreen from './templates/AppScreen.svelte';
	import FormInput from './molecules/FormInput.svelte';
	import CouponField from './molecules/CouponField.svelte';
	import CheckoutSummary from './organisms/CheckoutSummary.svelte';

	interface BowlSnapshot {
		bowlSize: BowlSize;
		items: Map<number, number>;
		quantity: number;
		includeCutlery: boolean;
	}

	interface Props {
		ingredients: Ingredient[];
		bowls: BowlSnapshot[];
		cartCount?: number;
		onBack: () => void;
	}

	let { ingredients, bowls, cartCount, onBack }: Props = $props();

	// Form state
	let name = $state('');
	let phone = $state('');
	let deliveryAddress = $state('');
	let deliveryInstructions = $state('');
	let submitting = $state(false);
	let formError = $state<string | null>(null);

	// Coupon + server quote. `couponCode` is the code sent with every quote; the
	// latest accepted quote decides whether it applied.
	let couponInput = $state('');
	let couponCode = $state<string | null>(null);
	let couponError = $state<string | null>(null);
	let quote = $state<CheckoutQuote | null>(null);
	let quotedAddress = $state('');
	let quoting = $state(false);
	let addressError = $state<string | null>(null);
	// Bumped per request so an older, slower response never overwrites a newer one.
	let quoteSeq = 0;

	// A quote only counts for the address it was made for.
	const freshQuote = $derived(quote && quotedAddress === deliveryAddress.trim() ? quote : null);
	const appliedCoupon = $derived(freshQuote?.coupon ?? null);

	// Per-field validation. Errors surface only after the first submit attempt,
	// then clear as each field is edited.
	let errors = $state<{ name?: string; phone?: string; address?: string }>({});
	let hasSubmitted = $state(false);

	function validate(): boolean {
		const next: typeof errors = {};
		if (!name.trim()) next.name = $_('delivery.errors.nameRequired');
		if (phone.length !== 10) next.phone = $_('delivery.errors.phoneInvalid');
		if (!deliveryAddress.trim()) next.address = $_('delivery.errors.addressRequired');
		errors = next;
		return Object.keys(next).length === 0;
	}

	// Clear-on-input: once submitted, re-validate reactively so a field's error
	// disappears as soon as it becomes valid.
	$effect(() => {
		// Reference fields so the effect re-runs on edits.
		void name;
		void phone;
		void deliveryAddress;
		if (hasSubmitted) validate();
	});

	function sizeLabel(bowlSize: BowlSize) {
		return bowlSize === 250
			? $_('size.small')
			: bowlSize === 450
				? $_('size.medium')
				: $_('size.large');
	}

	// Display-only unit prices; every amount below the bowl lines comes from the server quote.
	function unitPrice(bowl: BowlSnapshot) {
		const totals = computeBowlTotals(bowl.items, ingredients);
		const cutlery = bowl.includeCutlery ? CUTLERY_PRICE : 0;
		return roundToNearestCoin(bowlBasePrice(bowl.bowlSize) + totals.ingredientsPrice + cutlery);
	}

	const lines = $derived(
		bowls.map((b, i) => ({
			label: `${$_('cart.bowl.title', { values: { n: i + 1, size: sizeLabel(b.bowlSize) } })} × ${b.quantity}`,
			amount: unitPrice(b) * b.quantity
		}))
	);
	const clientSubtotal = $derived(lines.reduce((acc, l) => acc + l.amount, 0));

	const checkoutBowls = $derived<CheckoutBowl[]>(
		bowls.map((b) => ({
			bowlSize: b.bowlSize,
			items: Array.from(b.items, ([ingredientId, quantityGrams]) => ({
				ingredientId,
				quantityGrams
			})),
			includeCutlery: b.includeCutlery,
			quantity: b.quantity
		}))
	);

	function rejectionMessage(r: { reason: CouponRejection; minBowls?: number }) {
		return $_(`coupon.reason.${r.reason}`, { values: { count: r.minBowls ?? 0 } });
	}

	const isApiError = (e: unknown, status: number, message: string) =>
		e instanceof ApiError && e.status === status && e.message === message;

	async function requestQuote() {
		const seq = ++quoteSeq;
		const address = deliveryAddress.trim();
		if (!address) {
			quoting = false;
			return;
		}
		quoting = true;
		try {
			const q = await getCheckoutQuote({
				address,
				bowls: checkoutBowls,
				couponCode: couponCode ?? undefined,
				phone: phone.length === 10 ? phone : undefined
			});
			if (seq !== quoteSeq) return;
			quote = q;
			quotedAddress = address;
			addressError = null;
			formError = null;
			if (q.couponRejection) {
				couponError = rejectionMessage(q.couponRejection);
				couponCode = null;
			}
		} catch (e) {
			if (seq !== quoteSeq) return;
			quote = null;
			if (isApiError(e, 400, 'address_not_found')) {
				addressError = $_('delivery.errors.addressNotFound');
			} else {
				formError = $_('delivery.errors.quoteFailed');
			}
		} finally {
			if (seq === quoteSeq) quoting = false;
		}
	}

	function onAddressBlur() {
		if (deliveryAddress.trim() && !freshQuote) requestQuote();
	}

	function applyCoupon() {
		couponError = null;
		if (!deliveryAddress.trim()) {
			couponError = $_('coupon.needsAddress');
			return;
		}
		couponCode = couponInput.trim();
		requestQuote();
	}

	// Editing the code after it was sent drops it and re-prices without it.
	function onCouponEdit() {
		couponError = null;
		if (couponCode !== null) {
			couponCode = null;
			requestQuote();
		}
	}

	const couponSuccess = $derived(
		appliedCoupon && freshQuote
			? $_(`coupon.applied.${appliedCoupon.type}`, {
					values: { value: appliedCoupon.value ?? 0, amount: formatCOP(freshQuote.discount) }
				})
			: undefined
	);

	async function handleSubmit() {
		hasSubmitted = true;
		if (!validate() || !freshQuote) return;

		submitting = true;
		formError = null;
		const trimmedPhone = phone.trim();
		try {
			const checkout = await createCheckout({
				address: deliveryAddress.trim(),
				bowls: checkoutBowls,
				couponCode: appliedCoupon?.code,
				phone: trimmedPhone,
				customer: { name: name.trim(), phone: trimmedPhone },
				deliveryInstructions: deliveryInstructions.trim() || undefined
			});
			const redirectUrl = `${window.location.origin}${resolve('/order')}?c=${encodeURIComponent(checkout.checkoutId)}`;
			// Stay in the submitting state while the browser leaves for Wompi.
			window.location.assign(wompiCheckoutUrl(checkout, redirectUrl));
		} catch (e) {
			submitting = false;
			if (isApiError(e, 409, 'coupon_rejected')) {
				couponError = rejectionMessage(
					(e as ApiError).details as { reason: CouponRejection; minBowls?: number }
				);
				couponCode = null;
				requestQuote();
			} else if (isApiError(e, 400, 'address_not_found')) {
				quote = null;
				addressError = $_('delivery.errors.addressNotFound');
			} else if (isApiError(e, 503, 'ordersPaused')) {
				formError = $_('delivery.errors.ordersPaused');
			} else if (isApiError(e, 503, 'payments_unavailable')) {
				formError = $_('delivery.errors.paymentsUnavailable');
			} else {
				formError = $_('delivery.error');
			}
		}
	}
</script>

<AppScreen {onBack} {cartCount} fill>
	{#snippet heading()}
		<div class="flex flex-col gap-1 px-5 pb-4 pt-6">
			<div class="flex items-center gap-3">
				<svg
					width="24"
					height="24"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
					class="text-dark-green"
					aria-hidden="true"
				>
					<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
					<polyline points="22 4 12 14.01 9 11.01" />
				</svg>
				<h1 class="m-0 text-[24px] font-bold uppercase tracking-[1.2px] text-text-black">
					{$_('delivery.title')}
				</h1>
			</div>
			<p class="m-0 text-base leading-6 text-text-muted">
				{$_('delivery.subtitle')}
			</p>
		</div>
	{/snippet}

	<!-- Scrollable form area -->
	<div class="flex flex-1 flex-col gap-4 overflow-y-auto px-5 py-4">
		<FormInput
			id="delivery-name"
			label={$_('delivery.form.name.label')}
			bind:value={name}
			placeholder={$_('delivery.form.name.placeholder')}
			error={errors.name}
			required
		/>

		<FormInput
			id="delivery-phone"
			type="numeric"
			label={$_('delivery.form.phone.label')}
			bind:value={phone}
			placeholder={$_('delivery.form.phone.placeholder')}
			error={errors.phone}
			onblur={() => couponCode !== null && requestQuote()}
			required
		/>

		<FormInput
			id="delivery-address"
			type="textarea"
			label={$_('delivery.form.address.label')}
			bind:value={deliveryAddress}
			placeholder={$_('delivery.form.address.placeholder')}
			error={errors.address ?? addressError ?? undefined}
			onblur={onAddressBlur}
			required
		/>

		<FormInput
			id="delivery-instructions"
			type="textarea"
			label={$_('delivery.form.instructions.label')}
			bind:value={deliveryInstructions}
			placeholder={$_('delivery.form.instructions.placeholder')}
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
			quote={freshQuote}
			subtotal={clientSubtotal}
			hint={quoting ? $_('delivery.summary.quoting') : $_('delivery.summary.addressHint')}
		/>
	</div>

	<!-- Error message + CTA + consent notice — pinned at the bottom of the viewport -->
	<div class="flex flex-col gap-3 px-5 pb-10 pt-3">
		{#if formError}
			<p class="m-0 text-center text-sm text-red-500" role="alert">{formError}</p>
		{/if}

		<button
			type="button"
			disabled={submitting ||
				quoting ||
				!freshQuote ||
				!name.trim() ||
				phone.length !== 10 ||
				!deliveryAddress.trim()}
			onclick={handleSubmit}
			class="w-full cursor-pointer rounded-full border-none bg-dark-green px-6 py-4 text-sm font-bold text-light-green transition-all duration-200 hover:opacity-95 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50 [-webkit-tap-highlight-color:transparent]"
		>
			{#if submitting}
				{$_('delivery.confirming')}
			{:else if freshQuote}
				{$_('delivery.confirm', { values: { price: formatCOP(freshQuote.total) } })}
			{:else}
				{$_('delivery.confirmNoPrice')}
			{/if}
		</button>

		<!-- Law 1581 implicit-consent notice + privacy policy link. Placed here, at the
		     point PII is submitted, since the new app ships no global footer. -->
		<p class="m-0 px-2 text-center text-xs text-text-muted">
			{$_('footer.implicitConsent')}
			<a href={resolve('/privacy')} class="underline underline-offset-2 hover:text-text-black">
				{$_('footer.privacyPolicy')}
			</a>
		</p>
	</div>
</AppScreen>
