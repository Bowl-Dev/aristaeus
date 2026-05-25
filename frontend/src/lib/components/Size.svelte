<script lang="ts">
	import { _ } from 'svelte-i18n';
	import type { BowlSize } from '$lib/types';
	import { BOWL_SIZE_PRICES } from '$lib/types';
	import { formatCOP } from '$lib/utils/bowl';
	import AppScreen from './templates/AppScreen.svelte';
	import SizeCard from './molecules/SizeCard.svelte';

	let {
		onBack,
		onCart,
		onSelect,
		cartCount
	}: {
		onBack: () => void;
		onCart?: () => void;
		onSelect: (size: BowlSize) => void;
		cartCount?: number;
	} = $props();

	interface SizeOption {
		size: BowlSize;
		labelKey: string;
		capacity: string;
		basePrice: number;
	}

	const sizes: SizeOption[] = [
		{ size: 250, labelKey: 'size.small', capacity: '250g', basePrice: BOWL_SIZE_PRICES[0] },
		{ size: 450, labelKey: 'size.medium', capacity: '450g', basePrice: BOWL_SIZE_PRICES[1] },
		{ size: 600, labelKey: 'size.large', capacity: '600g', basePrice: BOWL_SIZE_PRICES[2] }
	];
</script>

<AppScreen {onBack} {onCart} {cartCount} title={$_('size.title')} subtitle={$_('size.subtitle')}>
	<div class="flex flex-col gap-4 px-5 pb-8">
		{#each sizes as option (option.size)}
			<SizeCard
				label={$_(option.labelKey)}
				capacity={option.capacity}
				capacityLabel={$_('size.capacity')}
				price={formatCOP(option.basePrice)}
				pricingNote={$_('size.pricingNote')}
				onclick={() => onSelect(option.size)}
			/>
		{/each}
	</div>
</AppScreen>
