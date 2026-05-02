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
</script>

<!-- Backdrop -->
<div
	class="backdrop"
	class:closing
	role="button"
	tabindex="-1"
	aria-label={$_('landing.modal.cancel')}
	onclick={dismiss}
	onkeydown={(e) => e.key === 'Escape' && dismiss()}
></div>

<!-- Bottom sheet -->
<div
	class="sheet"
	class:closing
	role="dialog"
	aria-modal="true"
	aria-label={$_('landing.modal.title')}
	onanimationend={handleAnimationEnd}
>
	<div class="sheet-handle"></div>

	<div class="options">
		<!-- From scratch -->
		<button class="option-card" onclick={onFromScratch}>
			<div class="option-image">
				<img src="/BuildBowl.png" alt={$_('landing.modal.fromScratch')} />
			</div>
			<span class="option-label">{$_('landing.modal.fromScratch')}</span>
		</button>

		<!-- Menu ideas -->
		<button class="option-card" onclick={onMenu}>
			<div class="option-image">
				<img src="/Menu.png" alt={$_('landing.modal.menuIdeas')} />
			</div>
			<span class="option-label">{$_('landing.modal.menuIdeas')}</span>
		</button>
	</div>

	<button class="cancel-btn" onclick={dismiss}>
		{$_('landing.modal.cancel')}
	</button>
</div>

<style>
	.backdrop {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.55);
		z-index: 40;
		cursor: pointer;
		animation: fadeIn 0.25s ease-out;
	}

	.backdrop.closing {
		animation: fadeOut 0.25s ease-in forwards;
	}

	.sheet {
		position: fixed;
		bottom: 0;
		left: 0;
		right: 0;
		z-index: 50;
		background: #ffffff;
		border-radius: 1.25rem 1.25rem 0 0;
		padding: 0.75rem 1.5rem 2.5rem;
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
		box-shadow: 0 -4px 32px rgba(0, 0, 0, 0.15);
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

	.sheet-handle {
		width: 2.5rem;
		height: 4px;
		background: #e0e0e0;
		border-radius: 9999px;
		margin: 0 auto 0.5rem;
	}

	.options {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.875rem;
	}

	.option-card {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.625rem;
		background: #f5f5f5;
		border: none;
		border-radius: 1rem;
		padding: 1rem 0.75rem;
		cursor: pointer;
		transition:
			background 0.2s,
			transform 0.1s;
	}

	.option-card:hover {
		background: #eeeeee;
	}

	.option-card:active {
		transform: scale(0.97);
	}

	.option-image {
		width: 4.5rem;
		height: 4.5rem;
		border-radius: 50%;
		overflow: hidden;
		flex-shrink: 0;
	}

	.option-image img {
		width: 100%;
		height: 100%;
		object-fit: contain;
		image-rendering: pixelated;
	}

	.option-label {
		font-size: 0.8125rem;
		font-weight: 600;
		color: #1a1a1a;
		text-align: center;
		line-height: 1.3;
	}

	.cancel-btn {
		background: none;
		border: none;
		color: #666666;
		font-size: 0.9375rem;
		font-weight: 500;
		cursor: pointer;
		padding: 0.5rem;
		text-align: center;
		transition: color 0.2s;
	}

	.cancel-btn:hover {
		color: #1a1a1a;
	}
</style>
