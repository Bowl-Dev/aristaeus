<script lang="ts">
	type Size = 'sm' | 'md' | 'lg';

	let {
		src,
		alt,
		size = 'md',
		pixelated = false,
		bg = 'transparent'
	}: {
		src: string;
		alt: string;
		size?: Size;
		pixelated?: boolean;
		bg?: string;
	} = $props();

	const sizes: Record<Size, string> = {
		sm: 'h-12 w-12',
		md: 'h-[4.5rem] w-[4.5rem]',
		lg: 'h-20 w-20'
	};

	const cls = $derived(`${sizes[size]} shrink-0 overflow-hidden rounded-full`);
	const style = $derived(`background:${bg};`);
</script>

<div class={cls} {style}>
	<img
		{src}
		{alt}
		class="h-full w-full object-contain"
		style={pixelated ? 'image-rendering: pixelated;' : ''}
	/>
</div>
