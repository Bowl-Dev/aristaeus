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
		cartCount,
		includeCutlery = $bindable(false)
	}: {
		onBack: () => void;
		onCart?: () => void;
		onSelect: (size: BowlSize) => void;
		cartCount?: number;
		includeCutlery?: boolean;
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

		<!-- Cutlery: an order-level extra applied to the bowl being built. -->
		<label
			class="flex cursor-pointer items-center gap-3 rounded-2xl bg-pure-white p-4 [-webkit-tap-highlight-color:transparent]"
		>
			<input
				type="checkbox"
				bind:checked={includeCutlery}
				class="h-5 w-5 rounded border-strokes text-dark-green focus:ring-dark-green"
			/>
			<span class="flex-1 text-[15px] font-semibold text-text-black">
				{$_('size.cutlery.label')}
			</span>
			<span class="text-sm font-semibold text-text-muted">{$_('size.cutlery.note')}</span>
		</label>
	</div>
</AppScreen>
