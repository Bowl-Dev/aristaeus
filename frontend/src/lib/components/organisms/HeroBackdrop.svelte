<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		imageSrc,
		imageAlt,
		children
	}: {
		imageSrc: string;
		imageAlt: string;
		children: Snippet;
	} = $props();
</script>

<div class="relative flex min-h-svh w-full flex-col overflow-hidden bg-dark-green">
	<div class="absolute inset-0 z-0">
		<img src={imageSrc} alt={imageAlt} class="h-full w-full object-cover object-center" />
		<div class="hero-overlay absolute inset-0"></div>
	</div>
	<div class="relative z-10 flex min-h-svh items-center justify-center">
		{@render children()}
	</div>
</div>

<style>
	.hero-overlay {
		background: linear-gradient(to bottom, rgba(0, 72, 60, 0.3) 0%, rgba(0, 72, 60, 0.75) 100%);
	}
</style>
