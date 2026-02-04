<script lang="ts">
	import type { BowlSize } from '$lib/types';
	import { _ } from 'svelte-i18n';

	interface Props {
		selectedSize: BowlSize | null;
		onSizeChange: (size: BowlSize) => void;
	}

	let { selectedSize, onSizeChange }: Props = $props();

	const bowlSizes: { size: BowlSize; nameKey: string }[] = [
		{ size: 250, nameKey: 'bowlSize.small' },
		{ size: 450, nameKey: 'bowlSize.medium' },
		{ size: 600, nameKey: 'bowlSize.large' }
	];
</script>

<section class="mb-8 pb-8 border-b border-surface-300 dark:border-surface-700">
	<h2 class="text-2xl font-bold mb-4">{$_('bowlSize.title')}</h2>
	<div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
		{#each bowlSizes as { size, nameKey } (size)}
			<button
				class="card p-6 flex flex-col items-center rounded-xl transition-all duration-300 hover:-translate-y-1 cursor-pointer {selectedSize ===
				size
					? 'bg-primary-500 text-white shadow-lg ring-2 ring-primary-300'
					: 'bg-surface-200 dark:bg-surface-700 hover:bg-surface-300 dark:hover:bg-surface-600'}"
				onclick={() => onSizeChange(size)}
				type="button"
			>
				<span class="text-xl font-bold">{$_(nameKey)}</span>
				<span class="font-semibold opacity-80">{size}g</span>
			</button>
		{/each}
	</div>
</section>
