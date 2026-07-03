<script lang="ts">
	let {
		label,
		capacity,
		price,
		pricingNotePrefix,
		fillLevel,
		onclick
	}: {
		label: string;
		capacity: string;
		price: string;
		pricingNotePrefix: string;
		fillLevel: 1 | 2 | 3;
		onclick: () => void;
	} = $props();
</script>

<button
	class="flex w-full cursor-pointer items-center justify-between gap-4 rounded-2xl border-none bg-pure-white p-4 text-left transition-colors duration-150 hover:bg-gray-50 active:bg-gray-100 [-webkit-tap-highlight-color:transparent]"
	{onclick}
>
	<div class="flex flex-col gap-2">
		<span class="text-[18px] font-bold uppercase tracking-[0.9px] text-text-black">
			{label}
		</span>
		<div class="flex items-end gap-2" aria-hidden="true">
			{#each [1, 2, 3] as level (level)}
				{@const size = 14 + (level - 1) * 6}
				{@const active = level === fillLevel}
				<svg
					width={size}
					height={size}
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
					class={active ? 'text-dark-green' : 'text-strokes'}
				>
					<path
						d="M4 8h16l-1.2 9.6a3 3 0 0 1-3 2.4H8.2a3 3 0 0 1-3-2.4L4 8Z"
						fill={active ? 'currentColor' : 'none'}
					/>
					<path d="M2 8h20" />
				</svg>
			{/each}
		</div>
	</div>
	<div class="flex flex-col items-end gap-0.5">
		<span class="text-2xl font-bold text-dark-green">{capacity}</span>
		<span class="text-xs text-text-muted">{pricingNotePrefix} {price}</span>
	</div>
</button>
