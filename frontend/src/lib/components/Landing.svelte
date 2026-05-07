<script lang="ts">
	import { _ } from 'svelte-i18n';

	let { onOrderNow }: { onOrderNow: () => void } = $props();
</script>

<div class="relative flex min-h-svh w-full flex-col overflow-hidden bg-[#0d3b2e]">
	<!-- Hero background image -->
	<div class="absolute inset-0 z-0">
		<img
			src="/LandingBackground.webp"
			alt="Bowl de comida"
			class="h-full w-full object-cover object-center"
		/>
		<div class="hero-overlay absolute inset-0"></div>
	</div>

	<!-- Content -->
	<div class="relative z-10 flex min-h-svh items-center justify-center">
		<div class="flex flex-col items-center gap-8">
			<div class="flex flex-col gap-3">
				<h1
					class="m-0 text-center text-5xl font-bold leading-none tracking-tight text-white"
					style="letter-spacing: -0.02em;"
				>
					alGramo.
				</h1>
				<p class="m-0 max-w-[280px] text-center text-base leading-snug text-white/85">
					{$_('landing.subtitle')}
				</p>
			</div>

			<button
				class="inline-flex cursor-pointer items-center justify-center rounded-full border-none bg-[#0d3b2e] px-8 py-4 text-sm font-bold uppercase tracking-widest text-[#d4e84a] transition-all duration-200 hover:bg-[#c8dc3e] hover:text-[#0d3b2e] active:scale-[0.97]"
				onclick={onOrderNow}
			>
				{$_('landing.cta')}
			</button>
		</div>
	</div>
</div>

<style>
	.hero-overlay {
		background: linear-gradient(to bottom, rgba(13, 59, 46, 0.3) 0%, rgba(13, 59, 46, 0.75) 100%);
	}
</style>
