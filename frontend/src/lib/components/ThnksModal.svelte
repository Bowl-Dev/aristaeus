<script lang="ts">
	import { _ } from 'svelte-i18n';

	let { onDismiss }: { onDismiss: () => void } = $props();
</script>

<!-- Backdrop -->
<div class="backdrop" role="presentation" aria-hidden="true"></div>

<!-- Modal -->
<div
	class="modal"
	role="dialog"
	aria-modal="true"
	aria-labelledby="thnks-title"
	aria-describedby="thnks-desc"
>
	<!-- Checkmark circle -->
	<div class="check-circle" aria-hidden="true">
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

	<h2 class="modal-title" id="thnks-title">{$_('thnks.title')}</h2>

	<p class="modal-message" id="thnks-desc">{$_('thnks.message')}</p>

	<button class="dismiss-btn" onclick={onDismiss}>
		{$_('thnks.dismiss')}
	</button>
</div>

<style>
	.backdrop {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.6);
		z-index: 40;
	}

	.modal {
		position: fixed;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		z-index: 50;
		width: calc(100% - 5rem);
		max-width: 18rem;
		background: #0d3b2e;
		border-radius: 1.5rem;
		padding: 2rem 1.5rem 1.75rem;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1rem;
		text-align: center;

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

	.check-circle {
		width: 4rem;
		height: 4rem;
		background: #d4e84a;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}

	.modal-title {
		font-size: 1.375rem;
		font-weight: 700;
		color: #d4e84a;
		margin: 0;
		line-height: 1.2;
	}

	.modal-message {
		font-size: 0.9375rem;
		color: rgba(255, 255, 255, 0.85);
		margin: 0;
		line-height: 1.55;
	}

	.dismiss-btn {
		margin-top: 0.25rem;
		width: 100%;
		background: #d4e84a;
		color: #0d3b2e;
		font-weight: 700;
		font-size: 0.875rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		padding: 1rem 1.5rem;
		border-radius: 9999px;
		border: none;
		cursor: pointer;
		transition:
			background 0.2s,
			transform 0.1s;
	}

	.dismiss-btn:hover {
		background: #c8dc3e;
	}

	.dismiss-btn:active {
		transform: scale(0.97);
	}
</style>
