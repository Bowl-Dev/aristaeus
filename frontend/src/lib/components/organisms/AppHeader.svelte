<script lang="ts">
	import { _ } from 'svelte-i18n';
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
</script>

<header
	class="sticky top-0 z-10 flex items-center justify-between border-b border-strokes bg-pure-white p-4"
>
	<div class="flex items-center gap-6">
		<BackButton onclick={onBack} ariaLabel={$_('common.back')} />
		<Logo size="sm" tone="dark" />
	</div>
	<CartIconButton onclick={onCart} ariaLabel="Cart" count={cartCount} />
</header>
