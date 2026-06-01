<script lang="ts">
	import { _ } from 'svelte-i18n';
	import { base } from '$app/paths';
	import BottomSheet from './organisms/BottomSheet.svelte';
	import OptionCard from './molecules/OptionCard.svelte';
	import Button from './atoms/Button.svelte';

	let {
		onFromScratch,
		onMenu,
		onCancel
	}: {
		onFromScratch: () => void;
		onMenu: () => void;
		onCancel: () => void;
	} = $props();
</script>

<BottomSheet ariaLabel={$_('landing.modal.title')} onDismiss={onCancel}>
	{#snippet children(dismiss: () => void)}
		<div class="grid grid-cols-2 gap-[0.875rem]">
			<OptionCard
				iconSrc={`${base}/BuildBowl.png`}
				iconAlt={$_('landing.modal.fromScratch')}
				label={$_('landing.modal.fromScratch')}
				onclick={onFromScratch}
			/>
			<OptionCard
				iconSrc={`${base}/Menu.png`}
				iconAlt={$_('landing.modal.menuIdeas')}
				label={$_('landing.modal.menuIdeas')}
				onclick={onMenu}
			/>
		</div>

		<Button variant="ghost" size="md" fullWidth onclick={dismiss} extraClass="py-2">
			{$_('landing.modal.cancel')}
		</Button>
	{/snippet}
</BottomSheet>
