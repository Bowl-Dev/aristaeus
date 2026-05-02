<script lang="ts">
	import { _ } from 'svelte-i18n';

	let { onOrderNow }: { onOrderNow: () => void } = $props();
</script>

<div class="landing-root">
	<!-- Hero background image -->
	<div class="hero-bg">
		<img src="/trazyn_placeholder.jpg" alt="Bowl de comida" class="hero-img" />
		<div class="hero-overlay"></div>
	</div>

	<!-- Content -->
	<div class="hero-content">
		<div class="hero-inner">
			<div class="hero-text">
				<h1 class="hero-title">alGramo.</h1>
				<p class="hero-subtitle">{$_('landing.subtitle')}</p>
			</div>

			<button class="cta-button" onclick={onOrderNow}>
				{$_('landing.cta')}
			</button>
		</div>
	</div>
</div>

<style>
	.landing-root {
		position: relative;
		min-height: 100svh;
		width: 100%;
		display: flex;
		flex-direction: column;
		overflow: hidden;
		background: #0d3b2e;
	}

	.hero-bg {
		position: absolute;
		inset: 0;
		z-index: 0;
	}

	.hero-img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		object-position: center;
	}

	.hero-overlay {
		position: absolute;
		inset: 0;
		background: linear-gradient(to bottom, rgba(13, 59, 46, 0.3) 0%, rgba(13, 59, 46, 0.75) 100%);
	}

	.hero-content {
		position: relative;
		z-index: 1;
		display: flex;
		justify-content: center;
		align-items: center;
		min-height: 100svh;
	}

	.hero-inner {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 2rem;
	}

	.hero-text {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.hero-title {
		text-align: center;
		font-size: 3rem;
		font-weight: 700;
		color: #ffffff;
		line-height: 1;
		letter-spacing: -0.02em;
		margin: 0;
	}

	.hero-subtitle {
		text-align: center;
		font-size: 1rem;
		color: rgba(255, 255, 255, 0.85);
		margin: 0;
		max-width: 280px;
		line-height: 1.4;
	}

	.cta-button {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		background: #0d3b2e;
		color: #d4e84a;
		font-weight: 700;
		font-size: 0.875rem;
		letter-spacing: 0.08em;
		padding: 1rem 2rem;
		border-radius: 9999px;
		border: none;
		cursor: pointer;
		text-transform: uppercase;
		transition:
			background 0.2s,
			transform 0.1s;
	}

	.cta-button:hover {
		background: #c8dc3e;
	}

	.cta-button:active {
		transform: scale(0.97);
	}
</style>
