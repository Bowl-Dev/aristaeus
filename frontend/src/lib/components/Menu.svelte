<script lang="ts">
	import { _ } from 'svelte-i18n';
	import { locale } from '$lib/i18n';
	import type { Menu as MenuType } from '$lib/types';
	import MenuCard from './MenuCard.svelte';
	import AppScreen from './templates/AppScreen.svelte';

	let {
		menus,
		loading,
		onBack,
		onCart,
		onCustomize,
		cartCount
	}: {
		menus: MenuType[];
		loading: boolean;
		onBack: () => void;
		onCart?: () => void;
		onCustomize: (menu: MenuType) => void;
		cartCount?: number;
	} = $props();
</script>

<AppScreen {onBack} {onCart} {cartCount} title={$_('menu.title')} subtitle={$_('menu.subtitle')}>
	<div class="mx-auto w-full max-w-6xl flex-1 px-8 pb-8">
		{#if loading}
			<div class="flex items-center justify-center px-4 py-12 text-[0.9375rem] text-text-muted">
				<p>{$_('common.loading')}</p>
			</div>
		{:else if menus.length === 0}
			<div class="flex items-center justify-center px-4 py-12 text-[0.9375rem] text-text-muted">
				<p>{$_('menu.empty')}</p>
			</div>
		{:else}
			<div class="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
				{#each menus as menu (menu.id)}
					<MenuCard {menu} locale={$locale ?? 'es'} {onCustomize} />
				{/each}
			</div>
		{/if}
	</div>
</AppScreen>
