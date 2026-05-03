<script lang="ts">
	import { _ } from 'svelte-i18n';
	import { locale } from '$lib/i18n';
	import type { Menu as MenuType } from '$lib/types';
	import MenuCard from './MenuCard.svelte';

	let {
		menus,
		loading,
		onBack,
		onCustomize
	}: {
		menus: MenuType[];
		loading: boolean;
		onBack: () => void;
		onCustomize: (menu: MenuType) => void;
	} = $props();
</script>

<div class="menu-view">
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
		<h1 class="section-title">{$_('menu.title')}</h1>
		<p class="section-subtitle">{$_('menu.subtitle')}</p>
	</div>

	<!-- Cards list -->
	<div class="cards-list">
		{#if loading}
			<div class="loading-state">
				<p>{$_('common.loading')}</p>
			</div>
		{:else if menus.length === 0}
			<div class="empty-state">
				<p>{$_('menu.empty')}</p>
			</div>
		{:else}
			{#each menus as menu (menu.id)}
				<MenuCard {menu} locale={$locale ?? 'es'} {onCustomize} />
			{/each}
		{/if}
	</div>
</div>

<style>
	.menu-view {
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

	.cards-list {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		padding: 0 1.25rem 2rem;
		flex: 1;
	}

	.loading-state,
	.empty-state {
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 3rem 1rem;
		color: #999999;
		font-size: 0.9375rem;
	}
</style>
