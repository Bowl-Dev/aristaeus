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

<div class="size-view">
	<!-- Top bar -->
	<header class="topbar">
		<button class="back-btn" onclick={onBack} aria-label={$_('common.back')}>
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

		<span class="logo">alGramo.</span>

		<div class="cart-icon" aria-hidden="true">
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
	<div class="heading">
		<h1 class="section-title">{$_('size.title')}</h1>
		<p class="section-subtitle">{$_('size.subtitle')}</p>
	</div>

	<!-- Size options -->
	<div class="size-list">
		{#each sizes as option (option.size)}
			<button class="size-row" onclick={() => onSelect(option.size)}>
				<div class="size-info">
					<span class="size-name">{$_(option.labelKey)}</span>
					<span class="size-capacity">{$_('size.capacity')}: {option.capacity}</span>
				</div>
				<div class="size-price-block">
					<span class="size-price">{formatCOP(option.basePrice)}</span>
					<span class="size-price-note">{$_(option.pricePerGKey)}</span>
				</div>
			</button>
		{/each}
	</div>
</div>

<style>
	.size-view {
		min-height: 100svh;
		background: #f7f7f7;
		display: flex;
		flex-direction: column;
	}

	.topbar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 1rem 1.25rem;
		background: #ffffff;
		border-bottom: 1px solid #f0f0f0;
		position: sticky;
		top: 0;
		z-index: 10;
	}

	.back-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		background: none;
		border: none;
		cursor: pointer;
		color: #1a1a1a;
		padding: 0.25rem;
		border-radius: 0.5rem;
		transition: background 0.15s;
		-webkit-tap-highlight-color: transparent;
	}

	.back-btn:hover {
		background: #f0f0f0;
	}

	.logo {
		font-size: 1.125rem;
		font-weight: 700;
		color: #1a1a1a;
		letter-spacing: -0.02em;
	}

	.cart-icon {
		color: #1a1a1a;
		opacity: 0.7;
		padding: 0.25rem;
	}

	.heading {
		padding: 1.5rem 1.25rem 1rem;
	}

	.section-title {
		font-size: 1.625rem;
		font-weight: 800;
		color: #1a1a1a;
		margin: 0 0 0.35rem;
		letter-spacing: -0.01em;
		text-transform: uppercase;
	}

	.section-subtitle {
		font-size: 0.9rem;
		color: #666666;
		margin: 0;
		line-height: 1.4;
	}

	.size-list {
		display: flex;
		flex-direction: column;
		gap: 0;
		padding: 0 1.25rem 2rem;
	}

	.size-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		background: #ffffff;
		border: none;
		border-bottom: 1px solid #f0f0f0;
		padding: 1.25rem 1rem;
		cursor: pointer;
		text-align: left;
		width: 100%;
		transition: background 0.15s;
		border-radius: 0;
		-webkit-tap-highlight-color: transparent;
		margin-top: 0.75rem;
		border-radius: 0.75rem;
	}

	.size-row:hover {
		background: #f9f9f9;
	}

	.size-row:active {
		background: #f2f2f2;
	}

	.size-info {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.size-name {
		font-size: 1rem;
		font-weight: 700;
		color: #1a1a1a;
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}

	.size-capacity {
		font-size: 0.875rem;
		color: #777777;
	}

	.size-price-block {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: 0.2rem;
	}

	.size-price {
		font-size: 1.25rem;
		font-weight: 700;
		color: #0d3b2e;
	}

	.size-price-note {
		font-size: 0.75rem;
		color: #999999;
	}
</style>
