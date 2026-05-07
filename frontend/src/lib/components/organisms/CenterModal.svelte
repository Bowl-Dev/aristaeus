<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		ariaLabelledby,
		ariaDescribedby,
		bg = 'bg-dark-green',
		children
	}: {
		ariaLabelledby?: string;
		ariaDescribedby?: string;
		bg?: string;
		children: Snippet;
	} = $props();

	const cls = $derived(
		`modal fixed left-1/2 top-1/2 z-50 flex w-[calc(100%-3rem)] max-w-[20rem] -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-4 rounded-3xl p-8 text-center drop-shadow-[0px_25px_25px_rgba(0,0,0,0.25)] ${bg}`
	);
</script>

<div class="fixed inset-0 z-40 bg-black/50" role="presentation" aria-hidden="true"></div>

<div
	class={cls}
	role="dialog"
	aria-modal="true"
	aria-labelledby={ariaLabelledby}
	aria-describedby={ariaDescribedby}
>
	{@render children()}
</div>

<style>
	.modal {
		animation: popIn 0.25s ease-out;
	}
	@keyframes popIn {
		from {
			opacity: 0;
			transform: translate(-50%, -50%) scale(0.92);
		}
		to {
			opacity: 1;
			transform: translate(-50%, -50%) scale(1);
		}
	}
</style>
