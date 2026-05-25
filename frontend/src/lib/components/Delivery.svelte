<script lang="ts">
	import { _ } from 'svelte-i18n';
	import type { Ingredient, BowlSize, CreateOrderRequest } from '$lib/types';
	import { computeBowlTotals, bowlBasePrice, formatCOP } from '$lib/utils/bowl';
	import { DEFAULT_DELIVERY_LOCALE } from '$lib/constants';
	import { createOrder, ApiError } from '$lib/api/client';
	import AppScreen from './templates/AppScreen.svelte';
	import FormInput from './molecules/FormInput.svelte';
	import Card from './molecules/Card.svelte';

	interface BowlSnapshot {
		bowlSize: BowlSize;
		items: Map<number, number>;
		quantity: number;
	}

	interface Props {
		ingredients: Ingredient[];
		bowls: BowlSnapshot[];
		cartCount?: number;
		onBack: () => void;
		onOrderSuccess: () => void;
	}

	let { ingredients, bowls, cartCount, onBack, onOrderSuccess }: Props = $props();

	// Form state
	let name = $state('');
	let phone = $state('');
	let deliveryAddress = $state('');
	let deliveryInstructions = $state('');
	let submitting = $state(false);
	let submitError = $state<string | null>(null);

	function sizeLabel(bowlSize: BowlSize) {
		return bowlSize === 250
			? $_('size.small')
			: bowlSize === 450
				? $_('size.medium')
				: $_('size.large');
	}

	function computeBowlUnit(bowl: BowlSnapshot) {
		const totals = computeBowlTotals(bowl.items, ingredients);
		return {
			...totals,
			unitPrice: bowlBasePrice(bowl.bowlSize) + totals.ingredientsPrice
		};
	}

	const bowlData = $derived(
		bowls.map((b, i) => {
			const unit = computeBowlUnit(b);
			return {
				...unit,
				bowlSize: b.bowlSize,
				quantity: b.quantity,
				totalPrice: unit.unitPrice * b.quantity,
				index: i
			};
		})
	);

	const grandTotal = $derived(bowlData.reduce((acc, b) => acc + b.totalPrice, 0));

	async function handleSubmit() {
		if (!name.trim() || !phone.trim() || !deliveryAddress.trim()) return;

		submitting = true;
		submitError = null;

		// One CreateOrderRequest per (bowl × quantity). Backend has no bulk endpoint yet.
		const requests: CreateOrderRequest[] = [];
		for (const bowl of bowls) {
			const payload: CreateOrderRequest = {
				bowlSize: bowl.bowlSize,
				customer: {
					name: name.trim(),
					phone: phone.trim(),
					address: {
						streetAddress: deliveryAddress.trim(),
						...DEFAULT_DELIVERY_LOCALE
					}
				},
				items: Array.from(bowl.items.entries()).map(([ingredientId, quantityGrams]) => ({
					ingredientId,
					quantityGrams
				})),
				includeCutlery: false
			};
			for (let i = 0; i < bowl.quantity; i++) requests.push(payload);
		}

		try {
			const results = await Promise.allSettled(requests.map((r) => createOrder(r)));
			const failures = results.filter((r) => r.status === 'rejected');
			if (failures.length === 0) {
				onOrderSuccess();
				return;
			}
			const first = failures[0] as PromiseRejectedResult;
			const reason = first.reason instanceof ApiError ? first.reason.message : $_('delivery.error');
			submitError =
				failures.length === requests.length
					? reason
					: $_('delivery.partialError', {
							values: { failed: failures.length, total: requests.length, reason }
						});
		} finally {
			submitting = false;
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
			required
		/>

		<FormInput
			id="delivery-phone"
			type="tel"
			label={$_('delivery.form.phone.label')}
			bind:value={phone}
			placeholder={$_('delivery.form.phone.placeholder')}
			required
		/>

		<FormInput
			id="delivery-address"
			type="textarea"
			label={$_('delivery.form.address.label')}
			bind:value={deliveryAddress}
			placeholder={$_('delivery.form.address.placeholder')}
			required
		/>

		<FormInput
			id="delivery-instructions"
			type="textarea"
			label={$_('delivery.form.instructions.label')}
			bind:value={deliveryInstructions}
			placeholder={$_('delivery.form.instructions.placeholder')}
		/>
	</div>

	<!-- Order summary card + CTA — in normal flow at the bottom -->
	<div class="flex flex-col gap-3 px-5 pb-10 pt-3">
		<!-- Order Summary Card -->
		<Card gap="gap-2">
			<p class="m-0 text-sm font-bold uppercase tracking-[0.5px] text-text-black">
				{$_('delivery.summary.title')}
			</p>
			{#each bowlData as bowl, i (i)}
				<div class="flex items-center justify-between">
					<span class="text-sm text-text-muted">
						Bowl {i + 1} - {sizeLabel(bowl.bowlSize)}
						{#if bowl.quantity > 1}
							× {bowl.quantity}
						{/if}
					</span>
					<span class="text-sm font-semibold text-text-black">{formatCOP(bowl.totalPrice)}</span>
				</div>
			{/each}
			<div class="mt-1 flex items-center justify-between border-t border-strokes pt-2">
				<span class="text-sm font-bold uppercase tracking-[0.5px] text-text-black">
					{$_('cart.total.label')}
				</span>
				<span class="text-base font-bold text-dark-green">{formatCOP(grandTotal)}</span>
			</div>
		</Card>

		<!-- Error message -->
		{#if submitError}
			<p class="m-0 text-center text-sm text-red-500">{submitError}</p>
		{/if}

		<!-- CTA Button -->
		<button
			type="button"
			disabled={submitting || !name.trim() || !phone.trim() || !deliveryAddress.trim()}
			onclick={handleSubmit}
			class="w-full cursor-pointer rounded-full border-none bg-dark-green px-6 py-4 text-sm font-bold text-light-green transition-all duration-200 hover:opacity-95 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50 [-webkit-tap-highlight-color:transparent]"
		>
			{#if submitting}
				{$_('delivery.confirming')}
			{:else}
				{$_('delivery.confirm', { values: { price: formatCOP(grandTotal) } })}
			{/if}
		</button>
	</div>
</AppScreen>
