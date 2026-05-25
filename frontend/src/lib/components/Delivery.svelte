<script lang="ts">
	import { _ } from 'svelte-i18n';
	import type { Ingredient, BowlSize, CreateOrderRequest } from '$lib/types';
	import { BOWL_SIZE_PRICES } from '$lib/types';
	import { createOrder, ApiError } from '$lib/api/client';
	import AppHeader from './organisms/AppHeader.svelte';

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

	const formatter = new Intl.NumberFormat('es-CO', {
		style: 'currency',
		currency: 'COP',
		minimumFractionDigits: 0,
		maximumFractionDigits: 0
	});

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
		let calories = 0,
			protein = 0,
			carbs = 0,
			fat = 0,
			weight = 0,
			price = 0;

		if (bowl.bowlSize === 250) price = BOWL_SIZE_PRICES[0];
		else if (bowl.bowlSize === 450) price = BOWL_SIZE_PRICES[1];
		else price = BOWL_SIZE_PRICES[2];

		bowl.items.forEach((qty, id) => {
			const ing = ingredients.find((i) => i.id === id);
			if (ing) {
				const mult = qty / 100;
				calories += ing.caloriesPer100g * mult;
				protein += ing.proteinGPer100g * mult;
				carbs += ing.carbsGPer100g * mult;
				fat += ing.fatGPer100g * mult;
				weight += qty;
				price += ing.pricePerG * qty;
			}
		});

		return {
			calories: Math.round(calories),
			protein: Math.round(protein),
			carbs: Math.round(carbs),
			fat: Math.round(fat),
			weight,
			unitPrice: price
		};
	}

	const bowlData = $derived(
		bowls.map((b, i) => ({
			...computeBowlUnit(b),
			bowlSize: b.bowlSize,
			quantity: b.quantity,
			totalPrice: computeBowlUnit(b).unitPrice * b.quantity,
			index: i
		}))
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
						neighborhood: 'Bogotá',
						city: 'Bogotá',
						department: 'Bogotá D.C.'
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

<div class="flex h-svh flex-col bg-white-green">
	<AppHeader {onBack} {cartCount} />

	<!-- Screen heading -->
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

	<!-- Scrollable form area -->
	<div class="flex flex-1 flex-col gap-4 overflow-y-auto px-5 py-4">
		<!-- Full Name -->
		<div class="flex flex-col gap-1.5">
			<label for="delivery-name" class="text-sm font-semibold text-text-black">
				{$_('delivery.form.name.label')} *
			</label>
			<input
				id="delivery-name"
				type="text"
				bind:value={name}
				placeholder={$_('delivery.form.name.placeholder')}
				class="rounded-xl border border-strokes bg-pure-white px-4 py-3 text-sm text-text-black placeholder:text-text-muted focus:border-dark-green focus:outline-none"
			/>
		</div>

		<!-- Phone -->
		<div class="flex flex-col gap-1.5">
			<label for="delivery-phone" class="text-sm font-semibold text-text-black">
				{$_('delivery.form.phone.label')} *
			</label>
			<input
				id="delivery-phone"
				type="tel"
				bind:value={phone}
				placeholder={$_('delivery.form.phone.placeholder')}
				class="rounded-xl border border-strokes bg-pure-white px-4 py-3 text-sm text-text-black placeholder:text-text-muted focus:border-dark-green focus:outline-none"
			/>
		</div>

		<!-- Delivery Address -->
		<div class="flex flex-col gap-1.5">
			<label for="delivery-address" class="text-sm font-semibold text-text-black">
				{$_('delivery.form.address.label')} *
			</label>
			<textarea
				id="delivery-address"
				bind:value={deliveryAddress}
				placeholder={$_('delivery.form.address.placeholder')}
				rows="3"
				class="resize-none rounded-xl border border-strokes bg-pure-white px-4 py-3 text-sm text-text-black placeholder:text-text-muted focus:border-dark-green focus:outline-none"
			></textarea>
		</div>

		<!-- Delivery Instructions (Optional) -->
		<div class="flex flex-col gap-1.5">
			<label for="delivery-instructions" class="text-sm font-semibold text-text-black">
				{$_('delivery.form.instructions.label')}
			</label>
			<textarea
				id="delivery-instructions"
				bind:value={deliveryInstructions}
				placeholder={$_('delivery.form.instructions.placeholder')}
				rows="3"
				class="resize-none rounded-xl border border-strokes bg-pure-white px-4 py-3 text-sm text-text-black placeholder:text-text-muted focus:border-dark-green focus:outline-none"
			></textarea>
		</div>
	</div>

	<!-- Order summary card + CTA — in normal flow at the bottom -->
	<div class="flex flex-col gap-3 px-5 pb-10 pt-3">
		<!-- Order Summary Card -->
		<div class="flex flex-col gap-2 rounded-2xl bg-pure-white p-4 shadow-sm">
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
					<span class="text-sm font-semibold text-text-black"
						>{formatter.format(bowl.totalPrice)}</span
					>
				</div>
			{/each}
			<div class="mt-1 flex items-center justify-between border-t border-strokes pt-2">
				<span class="text-sm font-bold uppercase tracking-[0.5px] text-text-black">
					{$_('cart.total.label')}
				</span>
				<span class="text-base font-bold text-dark-green">{formatter.format(grandTotal)}</span>
			</div>
		</div>

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
				{$_('delivery.confirm', { values: { price: formatter.format(grandTotal) } })}
			{/if}
		</button>
	</div>
</div>
