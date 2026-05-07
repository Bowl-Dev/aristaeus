<script lang="ts">
	let {
		title,
		subtitle
	}: {
		title: string;
		subtitle?: string;
	} = $props();
</script>

<div class="flex flex-col gap-2 px-8 pb-4 pt-6">
	<h1 class="m-0 text-[24px] font-bold uppercase tracking-[1.2px] text-text-black">{title}</h1>
	{#if subtitle}
		<p class="m-0 text-base leading-6 text-text-muted">{subtitle}</p>
	{/if}
</div>
