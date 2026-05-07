<script lang="ts">
	import { _ } from 'svelte-i18n';
	import HeroBackdrop from './organisms/HeroBackdrop.svelte';
	import HeroCopy from './molecules/HeroCopy.svelte';
	import Button from './atoms/Button.svelte';

	let { onOrderNow }: { onOrderNow: () => void } = $props();
</script>

<HeroBackdrop imageSrc="/LandingBackground.webp" imageAlt="Bowl de comida">
	<div class="flex flex-col items-center gap-8">
		<HeroCopy subtitle={$_('landing.subtitle')} />
		<Button variant="primary" onclick={onOrderNow}>
			{$_('landing.cta')}
		</Button>
	</div>
</HeroBackdrop>
