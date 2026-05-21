<script lang="ts">
	let {
		label,
		capacity,
		capacityLabel,
		price,
		pricingNote,
		onclick
	}: {
		label: string;
		capacity: string;
		capacityLabel: string;
		price: string;
		pricingNote: string;
		onclick: () => void;
	} = $props();
</script>

<button
	class="flex w-full cursor-pointer flex-col gap-4 rounded-2xl border-none bg-pure-white p-4 text-left transition-colors duration-150 hover:bg-gray-50 active:bg-gray-100 [-webkit-tap-highlight-color:transparent]"
	{onclick}
>
	<div class="flex items-center justify-between">
		<span class="text-[18px] font-bold uppercase tracking-[0.9px] text-text-black">
			{label}
		</span>
		<span class="text-2xl font-bold text-dark-green">{price}</span>
	</div>
	<div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
		<span class="text-sm text-text-muted">
			{capacityLabel}: <span class="font-semibold text-text-muted">{capacity}</span>
		</span>
		<span class="mt-2 text-right text-xs text-text-muted sm:mt-0">{pricingNote}</span>
	</div>
</button>
