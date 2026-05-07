<script lang="ts">
	import type { Snippet } from 'svelte';

	type Level = 1 | 2 | 3;
	type Tone = 'dark' | 'light' | 'accent';

	let {
		level = 1,
		tone = 'dark',
		uppercase = false,
		children,
		extraClass = ''
	}: {
		level?: Level;
		tone?: Tone;
		uppercase?: boolean;
		children: Snippet;
		extraClass?: string;
	} = $props();

	const sizes: Record<Level, string> = {
		1: 'text-[1.625rem] font-extrabold tracking-tight',
		2: 'text-[1.375rem] font-bold leading-tight',
		3: 'text-base font-bold tracking-[0.03em]'
	};

	const tones: Record<Tone, string> = {
		dark: 'text-text-black',
		light: 'text-pure-white',
		accent: 'text-light-green'
	};

	const cls = $derived(
		['m-0', sizes[level], tones[tone], uppercase ? 'uppercase' : '', extraClass]
			.filter(Boolean)
			.join(' ')
	);
</script>

{#if level === 1}
	<h1 class={cls} style="letter-spacing: -0.01em;">{@render children()}</h1>
{:else if level === 2}
	<h2 class={cls}>{@render children()}</h2>
{:else}
	<h3 class={cls}>{@render children()}</h3>
{/if}
