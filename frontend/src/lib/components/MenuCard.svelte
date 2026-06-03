<script lang="ts">
	import { _ } from 'svelte-i18n';
	import { base } from '$app/paths';
	import type { Menu } from '$lib/types';
	import { bowlBasePrice, roundToNearestCoin, formatCOP } from '$lib/utils/bowl';
	import Heading from './atoms/Heading.svelte';
	import Button from './atoms/Button.svelte';
	import NutritionalInfo from './molecules/NutritionalInfo.svelte';

	let {
		menu,
		locale,
		onCustomize
	}: {
		menu: Menu;
		locale: string;
		onCustomize: (menu: Menu) => void;
	} = $props();

	const name = $derived(locale === 'es' ? menu.nameEs : menu.nameEn);
	const description = $derived(locale === 'es' ? menu.descriptionEs : menu.descriptionEn);

	const imageUrl = $derived(menu.imageUrl ?? `${base}/bowl_placeholder.png`);

	let imageFailed = $state(false);

	const nutrition = $derived.by(() => {
		let calories = 0,
			protein = 0,
			fat = 0,
			carbs = 0;
		for (const item of menu.ingredients) {
			const mult = item.quantityGrams / 100;
			calories += item.caloriesPer100g * mult;
			protein += item.proteinGPer100g * mult;
			fat += item.fatGPer100g * mult;
			carbs += item.carbsGPer100g * mult;
		}
		return {
			calories: Math.round(calories),
			protein: Math.round(protein),
			fat: Math.round(fat),
			carbs: Math.round(carbs)
		};
	});

	// Mirrors the Cart's per-bowl unit price (without cutlery): base packaging
	// price plus the summed ingredient cost, rounded to the nearest coin.
	const totalPrice = $derived.by(() => {
		let ingredientsPrice = 0;
		for (const item of menu.ingredients) {
			ingredientsPrice += item.pricePerG * item.quantityGrams;
		}
		return roundToNearestCoin(bowlBasePrice(menu.bowlSize) + ingredientsPrice);
	});
</script>

<div
	class="flex flex-col overflow-hidden rounded-2xl bg-pure-white shadow-[0_1px_4px_rgba(0,0,0,0.06),0_2px_12px_rgba(0,0,0,0.04)]"
>
	<!-- Image -->
	<div class="aspect-[2/1] w-full overflow-hidden bg-accent-gray">
		{#if imageFailed}
			<div class="flex h-full w-full items-center justify-center bg-accent-gray text-text-muted">
				<svg
					width="48"
					height="48"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="1.5"
					stroke-linecap="round"
					stroke-linejoin="round"
					aria-hidden="true"
				>
					<rect x="3" y="3" width="18" height="18" rx="2" />
					<circle cx="8.5" cy="8.5" r="1.5" />
					<path d="M21 15l-5-5L5 21" />
				</svg>
			</div>
		{:else}
			<img
				src={imageUrl}
				alt={name}
				class="h-full w-full object-cover"
				onerror={() => (imageFailed = true)}
			/>
		{/if}
	</div>

	<!-- Body -->
	<div class="flex flex-col items-center justify-center gap-4 px-6 py-4">
		<div class="flex flex-col items-start gap-4 self-stretch">
			<Heading level={3} uppercase extraClass="text-[18px] tracking-[0.9px]">{name}</Heading>
			<p class="m-0 text-base leading-[1.625] text-text-muted">{description}</p>
		</div>

		<NutritionalInfo
			calories={nutrition.calories}
			protein={nutrition.protein}
			carbs={nutrition.carbs}
			fat={nutrition.fat}
		/>

		<div class="flex items-center justify-between self-stretch">
			<span class="text-sm font-medium uppercase tracking-[0.5px] text-text-muted">
				{$_('menu.card.price')}
			</span>
			<span class="text-[18px] font-bold text-dark-green">{formatCOP(totalPrice)}</span>
		</div>

		<Button
			variant="primary"
			size="md"
			extraClass="w-[264px] max-w-full"
			onclick={() => onCustomize(menu)}
		>
			{$_('menu.card.customize')}
		</Button>
	</div>
</div>
