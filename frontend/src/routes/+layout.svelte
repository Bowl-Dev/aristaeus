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

	// /new/* is the in-progress next-gen frontend; it ships its own footer treatment.
	// Every other route (legacy /, /admin/orders, /privacy, /privacy/delete) needs the
	// Privacy Policy link in the global Footer for Law 1581 compliance.
	const isNewRoute = $derived($page.route.id?.startsWith('/new') ?? false);
	const showFooter = $derived(!isNewRoute);

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
	<div class="min-h-screen flex flex-col">
		{#if !isNewRoute}
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
