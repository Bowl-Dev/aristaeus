<script lang="ts">
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';
	import { locale, setLocale, waitForLocale } from '$lib/i18n';
	import { isLoading } from 'svelte-i18n';
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import Footer from '$lib/components/Footer.svelte';

	let { children } = $props();
	let ready = $state(false);

	// The root route `/` is the customer ordering app: it has its own AppHeader and
	// surfaces the Law 1581 privacy link inside its Delivery step, so it omits the
	// global Footer and locale toggle (the toggle would overlap the cart icon — ENG-48).
	// The other routes (/admin/orders, /privacy, /privacy/delete) keep the global
	// Footer (privacy link) and locale toggle.
	const isAppRoute = $derived($page.route.id === '/');
	const showFooter = $derived(!isAppRoute);

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
	<div class="flex items-center justify-center h-dvh">
		<p class="text-xl text-surface-500">Loading...</p>
	</div>
{:else}
	<div class="min-h-screen flex flex-col">
		{#if !isAppRoute}
			<div class="fixed top-4 right-4 z-50">
				<button
					onclick={toggleLocale}
					class="btn bg-primary-500 hover:bg-primary-600 text-white px-4 py-2 rounded-lg font-semibold shadow-md"
				>
					{$locale === 'es' ? 'EN' : 'ES'}
				</button>
			</div>
		{/if}
		<div class="flex-1">
			{@render children()}
		</div>
		{#if showFooter}
			<Footer />
		{/if}
	</div>
{/if}
