<script lang="ts">
	import { _ } from 'svelte-i18n';

	let {
		onFromScratch,
		onMenu,
		onCancel
	}: {
		onFromScratch: () => void;
		onMenu: () => void;
		onCancel: () => void;
	} = $props();

	let closing = $state(false);

	function dismiss() {
		closing = true;
	}

	function handleAnimationEnd() {
		if (closing) onCancel();
	}

	// Mirror the focus-trap pattern from the legacy OrderSummary drawer:
	// focus the first action on mount, trap Tab inside the sheet, dismiss on Escape.
	$effect(() => {
		const sheet = document.querySelector<HTMLElement>('[data-landing-modal-sheet]');
		if (!sheet) return;
		const sel = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
		const els = Array.from(sheet.querySelectorAll<HTMLElement>(sel));
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

<!-- Backdrop -->
<div
	class="backdrop fixed inset-0 z-40 cursor-pointer bg-black/55"
	class:closing
	role="button"
	tabindex="-1"
	aria-label={$_('landing.modal.cancel')}
	onclick={dismiss}
	onkeydown={(e) => e.key === 'Escape' && dismiss()}
></div>

<!-- Bottom sheet -->
<div
	data-landing-modal-sheet
	class="sheet fixed bottom-0 left-0 right-0 z-50 flex flex-col gap-5 rounded-t-[1.25rem] bg-white px-6 pb-10 pt-3 shadow-[0_-4px_32px_rgba(0,0,0,0.15)]"
	class:closing
	role="dialog"
	aria-modal="true"
	aria-label={$_('landing.modal.title')}
	onanimationend={handleAnimationEnd}
>
	<div class="mx-auto mb-2 h-1 w-10 rounded-full bg-gray-200"></div>

	<div class="grid grid-cols-2 gap-[0.875rem]">
		<!-- From scratch -->
		<button
			class="flex cursor-pointer flex-col items-center gap-[0.625rem] rounded-2xl border-none bg-gray-100 px-3 py-4 transition-all duration-200 hover:bg-gray-200 active:scale-[0.97]"
			onclick={onFromScratch}
		>
			<div class="h-[4.5rem] w-[4.5rem] shrink-0 overflow-hidden rounded-full">
				<img
					src="/BuildBowl.png"
					alt={$_('landing.modal.fromScratch')}
					class="h-full w-full object-contain"
					style="image-rendering: pixelated;"
				/>
			</div>
			<span class="text-center text-[0.8125rem] font-semibold leading-snug text-[#1a1a1a]">
				{$_('landing.modal.fromScratch')}
			</span>
		</button>

		<!-- Menu ideas -->
		<button
			class="flex cursor-pointer flex-col items-center gap-[0.625rem] rounded-2xl border-none bg-gray-100 px-3 py-4 transition-all duration-200 hover:bg-gray-200 active:scale-[0.97]"
			onclick={onMenu}
		>
			<div class="h-[4.5rem] w-[4.5rem] shrink-0 overflow-hidden rounded-full">
				<img
					src="/Menu.png"
					alt={$_('landing.modal.menuIdeas')}
					class="h-full w-full object-contain"
					style="image-rendering: pixelated;"
				/>
			</div>
			<span class="text-center text-[0.8125rem] font-semibold leading-snug text-[#1a1a1a]">
				{$_('landing.modal.menuIdeas')}
			</span>
		</button>
	</div>

	<button
		class="cursor-pointer border-none bg-transparent py-2 text-center text-[0.9375rem] font-medium text-gray-500 transition-colors duration-200 hover:text-[#1a1a1a]"
		onclick={dismiss}
	>
		{$_('landing.modal.cancel')}
	</button>
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
