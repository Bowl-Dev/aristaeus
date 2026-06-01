<script lang="ts">
	import CenterModal from './CenterModal.svelte';

	interface Props {
		open: boolean;
		title: string;
		message?: string;
		confirmLabel: string;
		cancelLabel: string;
		onConfirm: () => void;
		onCancel: () => void;
		variant?: 'danger' | 'default';
	}

	let {
		open,
		title,
		message,
		confirmLabel,
		cancelLabel,
		onConfirm,
		onCancel,
		variant = 'default'
	}: Props = $props();

	// Cancel is the primary / safe action and receives default focus, so an
	// accidental Enter or stray activation cancels rather than confirms.
	let cancelBtn = $state<HTMLButtonElement | null>(null);
	// Marks the dialog body; a pointerdown outside it counts as click-outside.
	let body = $state<HTMLElement | null>(null);

	$effect(() => {
		if (!open) return;
		cancelBtn?.focus();

		function onKey(e: KeyboardEvent) {
			if (e.key === 'Escape') onCancel();
		}
		function onPointerDown(e: PointerEvent) {
			if (body && !body.contains(e.target as Node)) onCancel();
		}
		document.addEventListener('keydown', onKey);
		// Capture phase so the dismiss check runs regardless of stopPropagation
		// elsewhere; the original event that opened the modal has already
		// finished before this listener attaches, so it never self-dismisses.
		document.addEventListener('pointerdown', onPointerDown, true);
		return () => {
			document.removeEventListener('keydown', onKey);
			document.removeEventListener('pointerdown', onPointerDown, true);
		};
	});

	const confirmClass = $derived(
		variant === 'danger'
			? 'border border-red-300 bg-pure-white text-red-500 hover:bg-red-50'
			: 'border border-strokes bg-pure-white text-text-black hover:bg-accent-gray'
	);
</script>

{#if open}
	<CenterModal
		bg="bg-pure-white"
		ariaLabelledby="confirm-modal-title"
		ariaDescribedby={message ? 'confirm-modal-desc' : undefined}
	>
		<div bind:this={body} class="flex w-full flex-col items-center gap-4">
			<h2
				id="confirm-modal-title"
				class="m-0 text-[20px] font-bold leading-tight tracking-[0.4px] text-text-black"
			>
				{title}
			</h2>

			{#if message}
				<p id="confirm-modal-desc" class="m-0 text-base leading-[1.5] text-text-muted">
					{message}
				</p>
			{/if}

			<div class="mt-1 flex w-full flex-col gap-3">
				<!-- Cancel = primary, default focus -->
				<button
					bind:this={cancelBtn}
					type="button"
					class="w-full cursor-pointer rounded-full border-none bg-dark-green px-6 py-4 text-sm font-bold uppercase tracking-[0.08em] text-light-green transition-all duration-200 hover:opacity-95 active:scale-[0.97] [-webkit-tap-highlight-color:transparent]"
					onclick={onCancel}
				>
					{cancelLabel}
				</button>
				<!-- Confirm = secondary, danger-styled -->
				<button
					type="button"
					class="w-full cursor-pointer rounded-full px-6 py-4 text-sm font-semibold transition-all duration-200 active:scale-[0.97] [-webkit-tap-highlight-color:transparent] {confirmClass}"
					onclick={onConfirm}
				>
					{confirmLabel}
				</button>
			</div>
		</div>
	</CenterModal>
{/if}
