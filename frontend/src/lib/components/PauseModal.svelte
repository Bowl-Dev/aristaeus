<script lang="ts">
	import { _ } from 'svelte-i18n';
	import CenterModal from './organisms/CenterModal.svelte';
	import type { WeeklyHours } from '$lib/types';

	// With `weeklyHours` this is the "closed, outside service hours" variant (ENG-117);
	// without it, the manual-pause message.
	let { onDismiss, weeklyHours }: { onDismiss: () => void; weeklyHours?: WeeklyHours } = $props();

	// Monday-first lines, consecutive days with the same ranges grouped: "Lun – Vie: 9:30 – 15:00, 17:00 – 19:30".
	const hourLines = $derived.by(() => {
		if (!weeklyHours) return [];
		const days = $_('store.days') as unknown as string[];
		const ranges = (d: number) =>
			(weeklyHours[d] ?? []).map((r) => r.map((t) => t.replace(/^0/, '')).join(' – ')).join(', ') ||
			$_('store.closedDay');
		const lines: string[] = [];
		const order = [1, 2, 3, 4, 5, 6, 0];
		for (let i = 0; i < order.length; ) {
			let j = i;
			while (j + 1 < order.length && ranges(order[j + 1]) === ranges(order[i])) j++;
			const label = i === j ? days[order[i]] : `${days[order[i]]} – ${days[order[j]]}`;
			lines.push(`${label}: ${ranges(order[i])}`);
			i = j + 1;
		}
		return lines;
	});

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
		{weeklyHours ? $_('store.closed.title') : $_('pause.title')}
	</h2>

	<div id="pause-desc" class="flex flex-col gap-3">
		{#if weeklyHours}
			<p class="m-0 text-base leading-[1.6] text-pure-white">{$_('store.closed.body')}</p>
			<ul class="m-0 list-none p-0 text-base leading-[1.6] text-pure-white">
				{#each hourLines as line (line)}
					<li>{line}</li>
				{/each}
			</ul>
		{:else}
			{#each $_('pause.body') as paragraph, i (i)}
				<p class="m-0 text-base leading-[1.6] text-pure-white">{paragraph}</p>
			{/each}
		{/if}
	</div>
</CenterModal>
