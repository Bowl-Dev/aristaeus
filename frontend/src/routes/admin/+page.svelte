<script lang="ts">
	import { resolve } from '$app/paths';
	import { _ } from 'svelte-i18n';

	// Registry of operations applets surfaced on the admin hub. Adding a new applet
	// means appending an entry here plus its route under /admin/<path>.
	const applets = [
		{
			route: '/admin/orders',
			icon: '📋',
			titleKey: 'admin.hub.orders.title',
			descriptionKey: 'admin.hub.orders.description',
			ready: true
		},
		{
			route: '/admin/delivery-calculator',
			icon: '🛵',
			titleKey: 'admin.hub.deliveryCalculator.title',
			descriptionKey: 'admin.hub.deliveryCalculator.description',
			ready: false
		}
	] as const;
</script>

<main class="min-h-dvh bg-gray-50 p-4 md:p-8">
	<div class="max-w-5xl mx-auto">
		<!-- Header -->
		<header class="bg-white border border-gray-200 rounded-xl p-4 sm:p-6 mb-6">
			<div class="flex flex-col gap-4">
				<div>
					<h1 class="text-2xl sm:text-3xl font-bold text-gray-900">{$_('admin.hub.title')}</h1>
					<p class="text-sm text-gray-500 mt-1">{$_('admin.hub.subtitle')}</p>
				</div>
				<div>
					<a
						href={resolve('/')}
						class="inline-block px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
					>
						{$_('admin.hub.backToApp')}
					</a>
				</div>
			</div>
		</header>

		<!-- Applet cards -->
		<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
			{#each applets as applet (applet.route)}
				<a
					href={resolve(applet.route)}
					class="group bg-white border border-gray-200 rounded-xl p-6 hover:border-gray-900 hover:shadow-md transition-all flex flex-col gap-3"
				>
					<div class="flex items-start justify-between gap-3">
						<span class="text-3xl" aria-hidden="true">{applet.icon}</span>
						{#if !applet.ready}
							<span
								class="px-2 py-1 rounded-lg bg-gray-100 text-gray-600 text-xs font-semibold uppercase tracking-wide"
							>
								{$_('admin.hub.comingSoon')}
							</span>
						{/if}
					</div>
					<div>
						<h2 class="text-lg font-semibold text-gray-900 group-hover:underline">
							{$_(applet.titleKey)}
						</h2>
						<p class="text-sm text-gray-500 mt-1">{$_(applet.descriptionKey)}</p>
					</div>
				</a>
			{/each}
		</div>
	</div>
</main>
