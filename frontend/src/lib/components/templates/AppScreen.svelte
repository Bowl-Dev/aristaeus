<script lang="ts">
	import type { Snippet } from 'svelte';
	import AppHeader from '../organisms/AppHeader.svelte';
	import ScreenHeading from '../organisms/ScreenHeading.svelte';

	type Bg = 'white' | 'white-green';

	let {
		onBack,
		onCart,
		cartCount,
		title,
		subtitle,
		bg = 'white-green',
		fill = false,
		heading,
		children
	}: {
		onBack: () => void;
		onCart?: () => void;
		cartCount?: number;
		title?: string;
		subtitle?: string;
		bg?: Bg;
		fill?: boolean;
		heading?: Snippet;
		children: Snippet;
	} = $props();

	const bgClass = $derived(bg === 'white' ? 'bg-pure-white' : 'bg-white-green');
	const heightClass = $derived(fill ? 'h-svh' : 'min-h-svh');
</script>

<div class={`flex flex-col ${heightClass} ${bgClass}`}>
	<AppHeader {onBack} {onCart} {cartCount} />
	{#if heading}
		{@render heading()}
	{:else if title}
		<ScreenHeading {title} {subtitle} />
	{/if}
	{@render children()}
</div>
