<script lang="ts">
	import { _, locale } from 'svelte-i18n';
	import type { Ingredient, BowlSize } from '$lib/types';
	import { computeBowlTotals, bowlBasePrice, roundToNearestCoin, formatCOP } from '$lib/utils/bowl';
	import AppScreen from './templates/AppScreen.svelte';
	import Card from './molecules/Card.svelte';
	import NutritionChips from './molecules/NutritionChips.svelte';
	import IconButton from './atoms/IconButton.svelte';
	import ConfirmModal from './organisms/ConfirmModal.svelte';

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
		onProceedToDelivery: () => void;
		onCreateAnother: () => void;
		onRemoveBowl: (index: number) => void;
		onIncreaseBowl: (index: number) => void;
		onDecreaseBowl: (index: number) => void;
	}

	let {
		ingredients,
		bowls,
		cartCount,
		onBack,
		onProceedToDelivery,
		onCreateAnother,
		onRemoveBowl,
		onIncreaseBowl,
		onDecreaseBowl
	}: Props = $props();

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
			unitPrice: roundToNearestCoin(bowlBasePrice(bowl.bowlSize) + totals.ingredientsPrice)
		};
	}

	function ingredientSummary(bowl: BowlSnapshot, isEs: boolean) {
		const parts: string[] = [];
		bowl.items.forEach((qty, id) => {
			const ing = ingredients.find((i) => i.id === id);
			if (ing) parts.push(`${isEs ? ing.nameEs : ing.nameEn} (${qty}g)`);
		});
		return parts.join(', ');
	}

	// Read `$locale` directly inside the derivation so it becomes a tracked
	// dependency; Svelte 5's $derived does not propagate store subscriptions
	// across function call boundaries.
	const bowlData = $derived.by(() => {
		const isEs = $locale?.startsWith('es') ?? true;
		return bowls.map((b) => {
			const unit = computeBowlUnit(b);
			return {
				...unit,
				summary: ingredientSummary(b, isEs),
				bowlSize: b.bowlSize,
				quantity: b.quantity,
				totalPrice: unit.unitPrice * b.quantity,
				totalWeight: unit.weight * b.quantity
			};
		});
	});

	const grandTotal = $derived(bowlData.reduce((acc, b) => acc + b.totalPrice, 0));
	const grandWeight = $derived(bowlData.reduce((acc, b) => acc + b.totalWeight, 0));

	// Trash is the only deletion path (the − button clamps at 1), so it is gated
	// behind a confirmation modal to prevent accidental, irreversible removal.
	let pendingRemoveIndex = $state<number | null>(null);
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
					<circle cx="9" cy="21" r="1" />
					<circle cx="20" cy="21" r="1" />
					<path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
				</svg>
				<h1 class="m-0 text-[24px] font-bold uppercase tracking-[1.2px] text-text-black">
					{$_('cart.title')}
				</h1>
			</div>
			<p class="m-0 text-base leading-6 text-text-muted">
				{$_('cart.subtitle', { values: { count: bowls.length } })}
			</p>
		</div>
	{/snippet}

	<!-- Scrollable bowl list -->
	<div class="flex flex-1 flex-col gap-4 overflow-y-auto px-5 py-4 pb-6">
		{#each bowlData as bowl, i (i)}
			<Card>
				<!-- Card header: title + delete -->
				<div class="flex items-start justify-between gap-2">
					<div>
						<p class="m-0 text-sm font-bold uppercase tracking-[0.5px] text-text-black">
							{$_('cart.bowl.title', { values: { n: i + 1, size: sizeLabel(bowl.bowlSize) } })}
						</p>
						<p class="m-0 text-sm text-text-muted">{bowl.weight}g</p>
					</div>
					<IconButton
						variant="ghost-danger"
						ariaLabel={$_('cart.bowl.remove')}
						onclick={() => (pendingRemoveIndex = i)}
					>
						<svg
							width="18"
							height="18"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							stroke-linecap="round"
							stroke-linejoin="round"
							aria-hidden="true"
						>
							<polyline points="3 6 5 6 21 6" />
							<path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
							<path d="M10 11v6" />
							<path d="M14 11v6" />
							<path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
						</svg>
					</IconButton>
				</div>

				<!-- Ingredient summary -->
				<p class="m-0 text-sm leading-relaxed text-text-muted">{bowl.summary}</p>

				<!-- Nutrition chips -->
				<NutritionChips
					calories={bowl.calories}
					protein={bowl.protein}
					carbs={bowl.carbs}
					fat={bowl.fat}
					ariaLabel={$_('cart.bowl.nutrition')}
				/>

				<!-- Quantity stepper + price -->
				<div class="flex items-center justify-between">
					<div class="flex items-center gap-3">
						<IconButton
							variant="outline"
							ariaLabel={$_('cart.bowl.decrease')}
							disabled={bowl.quantity === 1}
							onclick={() => onDecreaseBowl(i)}
						>
							<svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
								<line
									x1="2"
									y1="6"
									x2="10"
									y2="6"
									stroke="currentColor"
									stroke-width="2"
									stroke-linecap="round"
								/>
							</svg>
						</IconButton>
						<span class="min-w-[1rem] text-center text-sm font-bold text-text-black">
							{bowl.quantity}
						</span>
						<IconButton
							variant="filled-primary"
							ariaLabel={$_('cart.bowl.increase')}
							onclick={() => onIncreaseBowl(i)}
						>
							<svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
								<line
									x1="6"
									y1="2"
									x2="6"
									y2="10"
									stroke="currentColor"
									stroke-width="2"
									stroke-linecap="round"
								/>
								<line
									x1="2"
									y1="6"
									x2="10"
									y2="6"
									stroke="currentColor"
									stroke-width="2"
									stroke-linecap="round"
								/>
							</svg>
						</IconButton>
					</div>
					<span class="text-base font-bold text-dark-green">{formatCOP(bowl.totalPrice)}</span>
				</div>
			</Card>
		{/each}
	</div>

	<!-- Total card -->
	<div class="px-5 pb-2 pt-3">
		<Card gap="gap-1">
			<div class="flex items-center justify-between">
				<span class="text-[18px] font-bold uppercase tracking-[0.9px] text-text-black">
					{$_('cart.total.label')}
				</span>
				<span class="text-[18px] font-bold text-dark-green">{formatCOP(grandTotal)}</span>
			</div>
			<p class="m-0 text-sm text-text-muted">
				{$_('cart.total.weight', { values: { weight: grandWeight } })}
			</p>
		</Card>
	</div>

	<!-- Action buttons -->
	<div class="flex flex-col gap-3 px-5 pb-10 pt-4">
		<button
			type="button"
			class="w-full cursor-pointer rounded-full border border-strokes bg-pure-white px-6 py-4 text-sm font-semibold text-text-black transition-all duration-200 hover:bg-accent-gray active:scale-[0.97] [-webkit-tap-highlight-color:transparent]"
			onclick={onCreateAnother}
		>
			{$_('cart.actions.createAnother')}
		</button>

		<button
			type="button"
			class="w-full cursor-pointer rounded-full border-none bg-dark-green px-6 py-4 text-sm font-bold text-light-green transition-all duration-200 hover:opacity-95 active:scale-[0.97] [-webkit-tap-highlight-color:transparent]"
			onclick={onProceedToDelivery}
		>
			{$_('cart.actions.proceedToDelivery', { values: { price: formatCOP(grandTotal) } })}
		</button>
	</div>
</AppScreen>

<ConfirmModal
	open={pendingRemoveIndex !== null}
	title={$_('cart.removeConfirm.title')}
	message={$_('cart.removeConfirm.message', { values: { n: (pendingRemoveIndex ?? 0) + 1 } })}
	confirmLabel={$_('cart.removeConfirm.confirm')}
	cancelLabel={$_('cart.removeConfirm.cancel')}
	variant="danger"
	onConfirm={() => {
		if (pendingRemoveIndex !== null) onRemoveBowl(pendingRemoveIndex);
		pendingRemoveIndex = null;
	}}
	onCancel={() => (pendingRemoveIndex = null)}
/>
