<script lang="ts">
	import favicon from '$lib/assets/favicon.svg';
	import '$lib/i18n';
	import { isLoading } from 'svelte-i18n';
	import { locale, setLocale } from '$lib/i18n';

	let { children } = $props();

	function toggleLocale() {
		const currentLocale = $locale;
		setLocale(currentLocale === 'es' ? 'en' : 'es');
	}
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

{#if $isLoading}
	<div class="loading">Loading...</div>
{:else}
	<div class="language-switcher">
		<button onclick={toggleLocale} class="lang-btn">
			{$locale === 'es' ? 'EN' : 'ES'}
		</button>
	</div>
	{@render children()}
{/if}

<style>
	.loading {
		display: flex;
		justify-content: center;
		align-items: center;
		height: 100vh;
		font-size: 1.5rem;
		color: #7f8c8d;
	}

	.language-switcher {
		position: fixed;
		top: 1rem;
		right: 1rem;
		z-index: 1000;
	}

	.lang-btn {
		padding: 0.5rem 1rem;
		background: #16a085;
		color: white;
		border: none;
		border-radius: 4px;
		font-weight: 600;
		cursor: pointer;
		transition: background 0.2s;
	}

	.lang-btn:hover {
		background: #138d75;
	}
</style>
