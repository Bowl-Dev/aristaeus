<script lang="ts">
	import { _ } from 'svelte-i18n';
	import CenterModal from './organisms/CenterModal.svelte';

	let { onDismiss }: { onDismiss: () => void } = $props();

	$effect(() => {
		const btn = document.querySelector<HTMLElement>('[data-pause-dismiss]');
		btn?.focus();
		function onKey(e: KeyboardEvent) {
			if (e.key === 'Escape') onDismiss();
		}
		document.addEventListener('keydown', onKey);
		return () => document.removeEventListener('keydown', onKey);
	});
</script>

<CenterModal ariaLabelledby="pause-title" ariaDescribedby="pause-desc">
	<!-- Close (X) button, top-right corner -->
	<button
		data-pause-dismiss
		class="absolute right-4 top-4 flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border-none bg-transparent text-pure-white transition-all duration-200 hover:opacity-95 active:scale-[0.97]"
		aria-label={$_('pause.close')}
		onclick={onDismiss}
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
			<line x1="18" y1="6" x2="6" y2="18" />
			<line x1="6" y1="6" x2="18" y2="18" />
		</svg>
	</button>

	<!-- Rocket -->
	<div class="text-5xl leading-none" aria-hidden="true">🚀</div>

	<h2
		id="pause-title"
		class="m-0 text-[24px] font-bold leading-tight tracking-[0.48px] text-light-green"
	>
		{$_('pause.title')}
	</h2>

	<div id="pause-desc" class="flex flex-col gap-3">
		{#each $_('pause.body') as paragraph, i (i)}
			<p class="m-0 text-base leading-[1.6] text-pure-white">{paragraph}</p>
		{/each}
	</div>
</CenterModal>
