<script lang="ts">
	import type { Snippet } from 'svelte';

	type Variant = 'ghost-danger' | 'outline' | 'filled-primary';

	let {
		variant = 'outline',
		ariaLabel,
		onclick,
		disabled = false,
		children
	}: {
		variant?: Variant;
		ariaLabel: string;
		onclick?: (e: MouseEvent) => void;
		disabled?: boolean;
		children: Snippet;
	} = $props();

	const base =
		'flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center transition-colors duration-150 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 [-webkit-tap-highlight-color:transparent]';

	const variants: Record<Variant, string> = {
		'ghost-danger': 'rounded-lg border-none bg-transparent text-red-400 hover:bg-red-50',
		outline:
			'rounded-full border border-strokes bg-pure-white text-text-black hover:bg-accent-gray',
		'filled-primary': 'rounded-full border-none bg-dark-green text-light-green hover:opacity-90'
	};

	const cls = $derived(`${base} ${variants[variant]}`);
</script>

<button type="button" class={cls} aria-label={ariaLabel} {disabled} {onclick}>
	{@render children()}
</button>
