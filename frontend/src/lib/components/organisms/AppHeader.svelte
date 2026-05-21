<script lang="ts">
	import { _, locale } from 'svelte-i18n';
	import { setLocale } from '$lib/i18n';
	import BackButton from '../atoms/BackButton.svelte';
	import CartIconButton from '../atoms/CartIconButton.svelte';
	import Logo from '../atoms/Logo.svelte';

	let {
		onBack,
		onCart,
		cartCount
	}: {
		onBack: () => void;
		onCart?: () => void;
		cartCount?: number;
	} = $props();

	function toggleLocale() {
		setLocale($locale === 'es' ? 'en' : 'es');
	}
</script>

<header
	class="sticky top-0 z-10 flex items-center justify-between border-b border-strokes bg-pure-white p-4"
>
	<div class="flex items-center gap-6">
		<BackButton onclick={onBack} ariaLabel={$_('common.back')} />
		<Logo size="sm" tone="dark" />
	</div>
	<div class="flex items-center gap-2">
		<button
			type="button"
			onclick={toggleLocale}
			aria-label="Toggle language"
			class="flex h-10 min-w-[40px] items-center justify-center rounded-full border border-strokes bg-pure-white px-3 text-sm font-semibold"
		>
			{$locale === 'es' ? 'EN' : 'ES'}
		</button>
		<CartIconButton onclick={onCart} ariaLabel="Cart" count={cartCount} />
	</div>
</header>
