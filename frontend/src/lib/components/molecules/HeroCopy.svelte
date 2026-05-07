<script lang="ts">
	import Logo from '../atoms/Logo.svelte';

	let { subtitle }: { subtitle: string } = $props();
</script>

<div class="flex flex-col items-center gap-3">
	<Logo size="lg" tone="light" />
	<p class="m-0 max-w-[280px] text-center text-base leading-snug text-pure-white/85">
		{subtitle}
	</p>
</div>
