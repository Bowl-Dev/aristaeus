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

		<span class="text-lg font-bold tracking-tight text-[#1a1a1a]" style="letter-spacing: -0.02em;">
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
			class="m-0 mb-[0.35rem] text-[1.625rem] font-extrabold uppercase tracking-tight text-[#1a1a1a]"
			style="letter-spacing: -0.01em;"
		>
			{$_('menu.title')}
		</h1>
		<p class="m-0 text-[0.9rem] leading-snug text-gray-500">{$_('menu.subtitle')}</p>
	</div>

	<!-- Cards list -->
	<div class="flex flex-1 flex-col gap-4 px-5 pb-8">
		{#if loading}
			<div class="flex items-center justify-center px-4 py-12 text-[0.9375rem] text-gray-400">
				<p>{$_('common.loading')}</p>
			</div>
		{:else if menus.length === 0}
			<div class="flex items-center justify-center px-4 py-12 text-[0.9375rem] text-gray-400">
				<p>{$_('menu.empty')}</p>
			</div>
		{:else}
			{#each menus as menu (menu.id)}
				<MenuCard {menu} locale={$locale ?? 'es'} {onCustomize} />
			{/each}
		{/if}
	</div>
</div>
