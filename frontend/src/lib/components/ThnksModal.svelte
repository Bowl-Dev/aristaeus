<script lang="ts">
	import { _ } from 'svelte-i18n';
	import CenterModal from './organisms/CenterModal.svelte';

	let { onDismiss }: { onDismiss: () => void } = $props();

	$effect(() => {
		const btn = document.querySelector<HTMLElement>('[data-thnks-dismiss]');
		btn?.focus();
		function onKey(e: KeyboardEvent) {
			if (e.key === 'Escape') onDismiss();
		}
		document.addEventListener('keydown', onKey);
		return () => document.removeEventListener('keydown', onKey);
	});
</script>

<CenterModal ariaLabelledby="thnks-title" ariaDescribedby="thnks-desc">
	<!-- Checkmark circle -->
	<div
		class="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-light-green"
		aria-hidden="true"
	>
		<svg
			width="36"
			height="36"
			viewBox="0 0 24 24"
			fill="none"
			stroke="#00483c"
			stroke-width="3"
			stroke-linecap="round"
			stroke-linejoin="round"
		>
			<polyline points="20 6 9 17 4 12" />
		</svg>
	</div>

	<h2
		id="thnks-title"
		class="m-0 max-w-[14rem] text-[24px] font-bold leading-tight tracking-[0.48px] text-light-green"
	>
		{$_('thnks.title')}
	</h2>

	<p class="m-0 text-base leading-[1.6] text-pure-white" id="thnks-desc">
		{$_('thnks.message')}
	</p>

	<button
		data-thnks-dismiss
		class="mt-1 w-full cursor-pointer rounded-full border-none bg-light-green px-20 py-4 text-sm font-bold uppercase tracking-[0.08em] text-dark-green transition-all duration-200 hover:opacity-95 active:scale-[0.97]"
		onclick={onDismiss}
	>
		{$_('thnks.dismiss')}
	</button>
</CenterModal>
