<script lang="ts">
	let {
		onclick,
		ariaLabel = 'Back'
	}: {
		onclick: () => void;
		ariaLabel?: string;
	} = $props();
</script>

<button
	class="flex cursor-pointer items-center justify-center rounded-lg border-none bg-transparent p-1 text-text-black transition-colors duration-150 hover:bg-black/5 [-webkit-tap-highlight-color:transparent]"
	{onclick}
	aria-label={ariaLabel}
>
	<svg
		width="20"
		height="20"
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		stroke-width="2.5"
		stroke-linecap="round"
		stroke-linejoin="round"
		aria-hidden="true"
	>
		<polyline points="15 18 9 12 15 6" />
	</svg>
</button>
