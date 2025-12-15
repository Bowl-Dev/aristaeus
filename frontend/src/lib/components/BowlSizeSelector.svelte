<script lang="ts">
	import type { BowlSize } from '$lib/types';
	import { _ } from 'svelte-i18n';

	// Props
	interface Props {
		selectedSize: BowlSize | null;
		onSizeChange: (size: BowlSize) => void;
	}

	let { selectedSize, onSizeChange }: Props = $props();

	const bowlSizes: { size: BowlSize; nameKey: string }[] = [
		{ size: 250, nameKey: 'bowlSize.small' },
		{ size: 320, nameKey: 'bowlSize.medium' },
		{ size: 600, nameKey: 'bowlSize.large' }
	];
</script>

<section class="bowl-size-selection">
	<h2>{$_('bowlSize.title')}</h2>
	<div class="bowl-sizes">
		{#each bowlSizes as { size, nameKey }}
			<button
				class="bowl-size-option"
				class:selected={selectedSize === size}
				onclick={() => onSizeChange(size)}
				type="button"
			>
				<span class="size-name">{$_(nameKey)}</span>
				<span class="size-capacity">{size}g</span>
			</button>
		{/each}
	</div>
</section>

<style>
	.bowl-size-selection {
		margin-bottom: 2rem;
		padding-bottom: 2rem;
		border-bottom: 1px solid #ecf0f1;
	}

	h2 {
		color: #34495e;
		font-size: 1.5rem;
		margin-bottom: 1rem;
	}

	.bowl-sizes {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 1rem;
	}

	.bowl-size-option {
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: 1.5rem 1rem;
		background: #f8f9fa;
		border: 3px solid #ecf0f1;
		border-radius: 8px;
		cursor: pointer;
		transition: all 0.3s;
		font-family: inherit;
	}

	.bowl-size-option:hover {
		background: #e9ecef;
		border-color: #16a085;
		transform: translateY(-2px);
	}

	.bowl-size-option.selected {
		background: #e8f8f5;
		border-color: #16a085;
		box-shadow: 0 4px 12px rgba(22, 160, 133, 0.2);
	}

	.bowl-size-option .size-name {
		font-size: 1.25rem;
		font-weight: 700;
		color: #2c3e50;
		margin-bottom: 0.5rem;
	}

	.bowl-size-option .size-capacity {
		font-size: 1rem;
		color: #7f8c8d;
		font-weight: 600;
	}

	.bowl-size-option.selected .size-name,
	.bowl-size-option.selected .size-capacity {
		color: #16a085;
	}

	/* Responsive Design */
	@media (max-width: 768px) {
		.bowl-sizes {
			grid-template-columns: 1fr;
		}
	}
</style>
