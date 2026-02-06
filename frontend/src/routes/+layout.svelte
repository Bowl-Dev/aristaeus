<script lang="ts">
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';
	import { locale, setLocale, waitForLocale } from '$lib/i18n';
	import { isLoading } from 'svelte-i18n';
	import { onMount } from 'svelte';

	let { children } = $props();
	let ready = $state(false);

	onMount(async () => {
		await waitForLocale();
		ready = true;
	});

	function toggleLocale() {
		const currentLocale = $locale;
		setLocale(currentLocale === 'es' ? 'en' : 'es');
	}
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

{#if !ready || $isLoading}
	<div class="flex items-center justify-center h-screen">
		<p class="text-xl text-surface-500">Loading...</p>
	</div>
{:else}
	<div class="fixed top-4 right-4 z-50">
		<button
			onclick={toggleLocale}
			class="btn bg-primary-500 hover:bg-primary-600 text-white px-4 py-2 rounded-lg font-semibold shadow-md"
		>
			{$locale === 'es' ? 'EN' : 'ES'}
		</button>
	</div>
	{@render children()}
{/if}
