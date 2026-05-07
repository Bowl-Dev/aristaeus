<script lang="ts">
	import { _ } from 'svelte-i18n';

	let { onDismiss }: { onDismiss: () => void } = $props();
</script>

<!-- Backdrop -->
<div class="fixed inset-0 z-40 bg-black/60" role="presentation" aria-hidden="true"></div>

<!-- Modal -->
<div
	class="modal fixed left-1/2 top-1/2 z-50 flex w-[calc(100%-5rem)] max-w-[18rem] -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-4 rounded-3xl bg-[#0d3b2e] px-6 pb-7 pt-8 text-center"
	role="dialog"
	aria-modal="true"
	aria-labelledby="thnks-title"
	aria-describedby="thnks-desc"
>
	<!-- Checkmark circle -->
	<div
		class="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-[#d4e84a]"
		aria-hidden="true"
	>
		<svg
			width="32"
			height="32"
			viewBox="0 0 24 24"
			fill="none"
			stroke="#0d3b2e"
			stroke-width="3"
			stroke-linecap="round"
			stroke-linejoin="round"
		>
			<polyline points="20 6 9 17 4 12" />
		</svg>
	</div>

	<h2 class="m-0 text-[1.375rem] font-bold leading-tight text-[#d4e84a]" id="thnks-title">
		{$_('thnks.title')}
	</h2>

	<p class="m-0 text-[0.9375rem] leading-[1.55] text-white/85" id="thnks-desc">
		{$_('thnks.message')}
	</p>

	<button
		class="mt-1 w-full cursor-pointer rounded-full border-none bg-[#d4e84a] px-6 py-4 text-sm font-bold uppercase tracking-[0.08em] text-[#0d3b2e] transition-all duration-200 hover:bg-[#c8dc3e] active:scale-[0.97]"
		onclick={onDismiss}
	>
		{$_('thnks.dismiss')}
	</button>
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
