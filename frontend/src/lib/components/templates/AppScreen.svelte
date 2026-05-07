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
		children
	}: {
		onBack: () => void;
		onCart?: () => void;
		cartCount?: number;
		title: string;
		subtitle?: string;
		bg?: Bg;
		children: Snippet;
	} = $props();

	const bgClass = $derived(bg === 'white' ? 'bg-pure-white' : 'bg-white-green');
</script>

<div class={`flex min-h-svh flex-col ${bgClass}`}>
	<AppHeader {onBack} {onCart} {cartCount} />
	<ScreenHeading {title} {subtitle} />
	{@render children()}
</div>
