<script lang="ts">
	import type { Snippet } from 'svelte';

	type Variant = 'primary' | 'ghost' | 'link';
	type Size = 'md' | 'lg';

	let {
		variant = 'primary',
		size = 'lg',
		type = 'button',
		disabled = false,
		ariaLabel,
		fullWidth = false,
		onclick,
		children,
		extraClass = ''
	}: {
		variant?: Variant;
		size?: Size;
		type?: 'button' | 'submit' | 'reset';
		disabled?: boolean;
		ariaLabel?: string;
		fullWidth?: boolean;
		onclick?: (e: MouseEvent) => void;
		children: Snippet;
		extraClass?: string;
	} = $props();

	const base =
		'inline-flex cursor-pointer items-center justify-center border-none transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-60 active:scale-[0.97]';

	const variants: Record<Variant, string> = {
		primary:
			'bg-dark-green text-light-green rounded-full font-bold uppercase tracking-[0.08em] hover:opacity-95',
		ghost: 'bg-transparent text-text-muted font-medium hover:text-text-black',
		link: 'bg-transparent text-dark-green underline underline-offset-2 font-medium'
	};

	const sizes: Record<Size, string> = {
		md: 'px-6 py-3 text-sm',
		lg: 'px-[72px] py-4 text-sm'
	};

	const cls = $derived(
		[base, variants[variant], sizes[size], fullWidth ? 'w-full' : '', extraClass]
			.filter(Boolean)
			.join(' ')
	);
</script>

<button {type} class={cls} {disabled} aria-label={ariaLabel} {onclick}>
	{@render children()}
</button>
