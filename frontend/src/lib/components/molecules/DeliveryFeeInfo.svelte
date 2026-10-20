<script lang="ts">
	import { _ } from 'svelte-i18n';
	import BottomSheet from '../organisms/BottomSheet.svelte';
	import Button from '../atoms/Button.svelte';

	let { onDismiss }: { onDismiss: () => void } = $props();
</script>

<BottomSheet ariaLabel={$_('delivery.feeInfo.title')} {onDismiss}>
	{#snippet children(dismiss: () => void)}
		<div
			class="flex max-h-[70svh] flex-col gap-4 overflow-y-auto text-sm leading-6 text-text-black"
		>
			<h2 class="m-0 text-lg font-bold leading-snug">{$_('delivery.feeInfo.title')}</h2>
			<p class="m-0">{$_('delivery.feeInfo.p1')}</p>
			<p class="m-0">{$_('delivery.feeInfo.p2')}</p>
			<p class="m-0">{$_('delivery.feeInfo.p3')}</p>
			<div class="flex flex-col gap-1 rounded-2xl bg-warm-beige p-4">
				<p class="m-0 font-bold">{$_('delivery.feeInfo.calloutTitle')}</p>
				<p class="m-0">
					{$_('delivery.feeInfo.calloutBefore')}<strong>{$_('delivery.feeInfo.calloutBold')}</strong
					>{$_('delivery.feeInfo.calloutAfter')}
				</p>
			</div>
			<p class="m-0 font-bold text-dark-green">{$_('delivery.feeInfo.closing')}</p>
		</div>
		<Button fullWidth onclick={dismiss}>{$_('delivery.feeInfo.ok')}</Button>
	{/snippet}
</BottomSheet>
