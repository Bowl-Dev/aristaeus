<script lang="ts">
	import type { Snippet } from 'svelte';

	type Variant = 'body' | 'caption' | 'muted' | 'subtitle';
	type Tone = 'default' | 'light' | 'muted' | 'dark';
	type Align = 'left' | 'center' | 'right';

	let {
		variant = 'body',
		tone = 'default',
		align = 'left',
		children,
		extraClass = ''
	}: {
		variant?: Variant;
		tone?: Tone;
		align?: Align;
		children: Snippet;
		extraClass?: string;
	} = $props();

	const variants: Record<Variant, string> = {
		body: 'text-base leading-snug',
		caption: 'text-xs',
		muted: 'text-sm',
		subtitle: 'text-[0.9rem] leading-snug'
	};

	const tones: Record<Tone, string> = {
		default: 'text-text-black',
		light: 'text-pure-white/85',
		muted: 'text-text-muted',
		dark: 'text-text-black'
	};

	const aligns: Record<Align, string> = {
		left: 'text-left',
		center: 'text-center',
		right: 'text-right'
	};

	const cls = $derived(
		['m-0', variants[variant], tones[tone], aligns[align], extraClass].filter(Boolean).join(' ')
	);
</script>

<p class={cls}>{@render children()}</p>
