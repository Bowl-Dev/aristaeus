<script lang="ts">
	import IconCircle from '../atoms/IconCircle.svelte';

	let {
		iconSrc,
		iconAlt,
		label,
		pixelated = false,
		onclick
	}: {
		iconSrc: string;
		iconAlt: string;
		label: string;
		pixelated?: boolean;
		onclick: () => void;
	} = $props();
</script>

<button
	class="flex cursor-pointer flex-col items-center gap-4 rounded-[var(--radius-card)] border-none bg-white-green px-11 py-6 transition-all duration-200 hover:brightness-95 active:scale-[0.97]"
	{onclick}
>
	<IconCircle src={iconSrc} alt={iconAlt} size="md" {pixelated} />
	<span class="text-center text-sm font-semibold leading-snug text-text-black">
		{label}
	</span>
</button>
