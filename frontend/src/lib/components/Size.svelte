<script lang="ts">
	import { _ } from 'svelte-i18n';
	import type { BowlSize } from '$lib/types';
	import { BOWL_SIZE_PRICES } from '$lib/types';

	let {
		onBack,
		onSelect
	}: {
		onBack: () => void;
		onSelect: (size: BowlSize) => void;
	} = $props();

	interface SizeOption {
		size: BowlSize;
		labelKey: string;
		capacity: string;
		basePrice: number;
		pricePerGKey: string;
	}

	const sizes: SizeOption[] = [
		{
			size: 250,
			labelKey: 'size.small',
			capacity: '250g',
			basePrice: BOWL_SIZE_PRICES[0],
			pricePerGKey: 'size.pricePerG.small'
		},
		{
			size: 450,
			labelKey: 'size.medium',
			capacity: '450g',
			basePrice: BOWL_SIZE_PRICES[1],
			pricePerGKey: 'size.pricePerG.medium'
		},
		{
			size: 600,
			labelKey: 'size.large',
			capacity: '600g',
			basePrice: BOWL_SIZE_PRICES[2],
			pricePerGKey: 'size.pricePerG.large'
		}
	];

	function formatCOP(amount: number): string {
		return new Intl.NumberFormat('es-CO', {
			style: 'currency',
			currency: 'COP',
			minimumFractionDigits: 0,
			maximumFractionDigits: 0
		}).format(amount);
	}
</script>

<div class="flex min-h-svh flex-col bg-gray-100">
	<!-- Top bar -->
	<header
		class="sticky top-0 z-10 flex items-center justify-between border-b border-gray-100 bg-white px-5 py-4"
	>
		<button
			class="flex cursor-pointer items-center justify-center rounded-lg border-none bg-transparent p-1 text-[#1a1a1a] transition-colors duration-150 hover:bg-gray-100 [-webkit-tap-highlight-color:transparent]"
			onclick={onBack}
			aria-label={$_('common.back')}
		>
			<svg
				width="20"
				height="20"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2.5"
				stroke-linecap="round"
				stroke-linejoin="round"
			>
				<polyline points="15 18 9 12 15 6" />
			</svg>
		</button>

		<span class="text-lg font-bold text-[#1a1a1a]" style="letter-spacing: -0.02em;">
			alGramo.
		</span>

		<div class="p-1 text-[#1a1a1a] opacity-70" aria-hidden="true">
			<svg
				width="22"
				height="22"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
			>
				<circle cx="9" cy="21" r="1" />
				<circle cx="20" cy="21" r="1" />
				<path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
			</svg>
		</div>
	</header>

	<!-- Heading -->
	<div class="px-5 pb-4 pt-6">
		<h1
			class="m-0 mb-[0.35rem] text-[1.625rem] font-extrabold uppercase text-[#1a1a1a]"
			style="letter-spacing: -0.01em;"
		>
			{$_('size.title')}
		</h1>
		<p class="m-0 text-[0.9rem] leading-snug text-gray-500">{$_('size.subtitle')}</p>
	</div>

	<!-- Size options -->
	<div class="flex flex-col gap-0 px-5 pb-8">
		{#each sizes as option (option.size)}
			<button
				class="mt-3 flex w-full cursor-pointer items-center justify-between rounded-xl border-none border-b border-gray-100 bg-white px-4 py-5 text-left transition-colors duration-150 hover:bg-gray-50 active:bg-gray-100 [-webkit-tap-highlight-color:transparent]"
				onclick={() => onSelect(option.size)}
			>
				<div class="flex flex-col gap-1">
					<span class="text-base font-bold uppercase tracking-[0.04em] text-[#1a1a1a]">
						{$_(option.labelKey)}
					</span>
					<span class="text-sm text-gray-500">
						{$_('size.capacity')}: {option.capacity}
					</span>
				</div>
				<div class="flex flex-col items-end gap-[0.2rem]">
					<span class="text-xl font-bold text-[#0d3b2e]">{formatCOP(option.basePrice)}</span>
					<span class="text-xs text-gray-400">{$_(option.pricePerGKey)}</span>
				</div>
			</button>
		{/each}
	</div>
</div>
