<script lang="ts">
	import type { Snippet } from 'svelte';
	import GrabBar from '../atoms/GrabBar.svelte';

	let {
		ariaLabel,
		onDismiss,
		children
	}: {
		ariaLabel: string;
		onDismiss: () => void;
		children: Snippet<[() => void]>;
	} = $props();

	let closing = $state(false);
	let sheetEl = $state<HTMLDivElement | null>(null);

	function dismiss() {
		closing = true;
	}

	function handleAnimationEnd() {
		if (closing) onDismiss();
	}

	$effect(() => {
		if (!sheetEl) return;
		const sel = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
		const els = Array.from(sheetEl.querySelectorAll<HTMLElement>(sel));
		els[0]?.focus();
		function trap(e: KeyboardEvent) {
			if (e.key === 'Escape') {
				dismiss();
				return;
			}
			if (e.key !== 'Tab' || els.length === 0) return;
			const first = els[0];
			const last = els[els.length - 1];
			if (e.shiftKey ? document.activeElement === first : document.activeElement === last) {
				e.preventDefault();
				(e.shiftKey ? last : first)?.focus();
			}
		}
		document.addEventListener('keydown', trap);
		return () => document.removeEventListener('keydown', trap);
	});
</script>

<!-- Backdrop: rgba(0,0,0,0.5) per Figma 49:58, hero remains visible -->
<div
	class="backdrop fixed inset-0 z-40 cursor-pointer"
	style="background: rgba(0,0,0,0.5);"
	class:closing
	role="button"
	tabindex="-1"
	aria-label={ariaLabel}
	onclick={dismiss}
	onkeydown={(e) => e.key === 'Escape' && dismiss()}
></div>

<!-- Sheet -->
<div
	bind:this={sheetEl}
	class="sheet fixed bottom-0 left-0 right-0 z-50 flex flex-col gap-5 rounded-t-[var(--radius-sheet)] bg-pure-white px-6 pb-10 pt-3 shadow-[0_-4px_32px_rgba(0,0,0,0.15)] sm:left-1/2 sm:right-auto sm:w-full sm:max-w-md sm:-translate-x-1/2"
	class:closing
	role="dialog"
	aria-modal="true"
	aria-label={ariaLabel}
	onanimationend={handleAnimationEnd}
>
	<div class="mb-2">
		<GrabBar />
	</div>
	{@render children(dismiss)}
</div>

<style>
	.backdrop {
		animation: fadeIn 0.25s ease-out;
	}
	.backdrop.closing {
		animation: fadeOut 0.25s ease-in forwards;
	}
	.sheet {
		animation: slideUp 0.25s ease-out;
	}
	.sheet.closing {
		animation: slideDown 0.25s ease-in forwards;
	}
	@keyframes slideUp {
		from {
			transform: translateY(100%);
		}
		to {
			transform: translateY(0);
		}
	}
	@keyframes slideDown {
		from {
			transform: translateY(0);
		}
		to {
			transform: translateY(100%);
		}
	}
	@keyframes fadeIn {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}
	@keyframes fadeOut {
		from {
			opacity: 1;
		}
		to {
			opacity: 0;
		}
	}
</style>
