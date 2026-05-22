<script lang="ts">
	import { _ } from 'svelte-i18n';
	import type { Ingredient, BowlSize } from '$lib/types';
	import { BOWL_SIZE_PRICES } from '$lib/types';
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

	const formatter = new Intl.NumberFormat('es-CO', {
		style: 'currency',
		currency: 'COP',
		minimumFractionDigits: 0,
		maximumFractionDigits: 0
	});

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

	function ingredientSummary(bowl: BowlSnapshot) {
		const parts: string[] = [];
		bowl.items.forEach((qty, id) => {
			const ing = ingredients.find((i) => i.id === id);
			if (ing) parts.push(`${ing.nameEs} (${qty}g)`);
		});
		return parts.join(', ');
	}

	const bowlData = $derived(
		bowls.map((b) => ({
			...computeBowlUnit(b),
			summary: ingredientSummary(b),
			bowlSize: b.bowlSize,
			quantity: b.quantity,
			totalPrice: computeBowlUnit(b).unitPrice * b.quantity,
			totalWeight: computeBowlUnit(b).weight * b.quantity
		}))
	);

	const grandTotal = $derived(bowlData.reduce((acc, b) => acc + b.totalPrice, 0));
	const grandWeight = $derived(bowlData.reduce((acc, b) => acc + b.totalWeight, 0));
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

	<!-- Scrollable bowl list -->
	<div class="flex flex-1 flex-col gap-4 overflow-y-auto px-5 py-4 pb-6">
		{#each bowlData as bowl, i (i)}
			<div class="flex flex-col gap-3 rounded-2xl bg-pure-white p-4 shadow-sm">
				<!-- Card header: title + delete -->
				<div class="flex items-start justify-between gap-2">
					<div>
						<p class="m-0 text-sm font-bold uppercase tracking-[0.5px] text-text-black">
							{$_('cart.bowl.title', { values: { n: i + 1, size: sizeLabel(bowl.bowlSize) } })}
						</p>
						<p class="m-0 text-sm text-text-muted">{bowl.weight}g</p>
					</div>
					<button
						type="button"
						class="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg border-none bg-transparent text-red-400 transition-colors duration-150 hover:bg-red-50 active:scale-95 [-webkit-tap-highlight-color:transparent]"
						onclick={() => onRemoveBowl(i)}
						aria-label={$_('cart.bowl.remove')}
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
					</button>
				</div>

				<!-- Ingredient summary -->
				<p class="m-0 text-sm leading-relaxed text-text-muted">{bowl.summary}</p>

				<!-- Nutrition chips -->
				<div
					class="grid grid-cols-4 gap-2 rounded-xl bg-text-black p-3"
					role="list"
					aria-label={$_('cart.bowl.nutrition')}
				>
					{#each [{ label: $_('menu.card.calories'), value: `${bowl.calories}` }, { label: $_('menu.card.protein'), value: `${bowl.protein}g` }, { label: $_('menu.card.carbs'), value: `${bowl.carbs}g` }, { label: $_('menu.card.fat'), value: `${bowl.fat}g` }] as chip (chip.label)}
						<div class="flex flex-col items-center gap-0.5" role="listitem">
							<span class="text-[9px] font-medium uppercase tracking-[0.6px] text-pure-white/60">
								{chip.label}
							</span>
							<span class="text-sm font-bold text-pure-white">{chip.value}</span>
						</div>
					{/each}
				</div>

				<!-- Quantity stepper + price -->
				<div class="flex items-center justify-between">
					<div class="flex items-center gap-3">
						<button
							type="button"
							class="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-strokes bg-pure-white text-text-black transition-colors duration-150 hover:bg-accent-gray active:scale-95 [-webkit-tap-highlight-color:transparent]"
							onclick={() => onDecreaseBowl(i)}
							aria-label={$_('cart.bowl.decrease')}
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
						</button>
						<span class="min-w-[1rem] text-center text-sm font-bold text-text-black">
							{bowl.quantity}
						</span>
						<button
							type="button"
							class="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border-none bg-dark-green text-light-green transition-colors duration-150 hover:opacity-90 active:scale-95 [-webkit-tap-highlight-color:transparent]"
							onclick={() => onIncreaseBowl(i)}
							aria-label={$_('cart.bowl.increase')}
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
						</button>
					</div>
					<span class="text-base font-bold text-dark-green"
						>{formatter.format(bowl.totalPrice)}</span
					>
				</div>
			</div>
		{/each}
	</div>

	<!-- Total card — always visible above fixed action buttons -->
	<div class="px-5 pb-2 pt-3">
		<div class="flex flex-col gap-1 rounded-2xl bg-pure-white p-4 shadow-sm">
			<div class="flex items-center justify-between">
				<span class="text-[18px] font-bold uppercase tracking-[0.9px] text-text-black">
					{$_('cart.total.label')}
				</span>
				<span class="text-[18px] font-bold text-dark-green">{formatter.format(grandTotal)}</span>
			</div>
			<p class="m-0 text-sm text-text-muted">
				{$_('cart.total.weight', { values: { weight: grandWeight } })}
			</p>
		</div>
	</div>

	<!-- Action buttons — in normal flow so layout sums to h-svh with no overlap -->
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
			{$_('cart.actions.proceedToDelivery', { values: { price: formatter.format(grandTotal) } })}
		</button>
	</div>
</div>
