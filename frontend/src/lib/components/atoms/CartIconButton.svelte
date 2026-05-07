<script lang="ts">
	let {
		onclick,
		ariaLabel = 'Cart',
		count
	}: {
		onclick?: () => void;
		ariaLabel?: string;
		count?: number;
	} = $props();

	const hasCount = $derived(typeof count === 'number');

	const cls = $derived(
		hasCount
			? 'flex h-8 w-[58px] cursor-pointer items-center justify-center gap-2 rounded-full border-none bg-accent-gray px-[10px] text-text-black transition-opacity duration-150 hover:opacity-90 [-webkit-tap-highlight-color:transparent]'
			: 'flex cursor-pointer items-center justify-center rounded-lg border-none bg-transparent p-1 text-text-black opacity-70 transition-opacity duration-150 hover:opacity-100 [-webkit-tap-highlight-color:transparent]'
	);
</script>

<button class={cls} {onclick} aria-label={ariaLabel}>
	<svg
		width="22"
		height="22"
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		stroke-width="2"
		stroke-linecap="round"
		stroke-linejoin="round"
		aria-hidden="true"
	>
		<circle cx="9" cy="21" r="1" />
		<circle cx="20" cy="21" r="1" />
		<path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
	</svg>
	{#if hasCount}
		<span class="text-sm font-semibold leading-none text-text-black">{count}</span>
	{/if}
</button>
