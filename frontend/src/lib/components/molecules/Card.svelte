<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		gap = 'gap-3',
		padding = 'p-4',
		extraClass = '',
		children
	}: {
		gap?: string;
		padding?: string;
		extraClass?: string;
		children: Snippet;
	} = $props();
</script>

<div class={`flex flex-col rounded-2xl bg-pure-white shadow-sm ${gap} ${padding} ${extraClass}`}>
	{@render children()}
</div>
