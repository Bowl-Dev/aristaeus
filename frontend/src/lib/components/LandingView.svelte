<script lang="ts">
	import { _ } from 'svelte-i18n';

	let {
		onBuildOwn,
		onViewMenu
	}: {
		onBuildOwn: () => void;
		onViewMenu: () => void;
	} = $props();
</script>

<div class="min-h-screen bg-gray-50 flex flex-col font-sans">
	<div class="flex-1 flex flex-col items-center justify-center px-6 py-16">
		<div class="text-center mb-12">
			<h1 class="text-4xl font-bold text-gray-900 tracking-tight mb-3">{$_('home.title')}</h1>
			<p class="text-lg text-gray-500">{$_('home.landing.headline')}</p>
		</div>

		<div class="grid grid-cols-1 md:grid-cols-2 gap-5 w-full max-w-2xl">
			<!-- Build Your Own -->
			<button
				class="group bg-white border-2 border-gray-200 rounded-2xl p-8 text-left hover:border-emerald-400 hover:shadow-lg transition-all duration-200 cursor-pointer"
				onclick={onBuildOwn}
			>
				<div class="text-4xl mb-4">🥣</div>
				<h2
					class="text-xl font-semibold text-gray-900 mb-2 group-hover:text-emerald-700 transition-colors"
				>
					{$_('home.landing.builder.title')}
				</h2>
				<p class="text-gray-500 text-sm leading-relaxed">
					{$_('home.landing.builder.description')}
				</p>
				<div class="mt-6 flex items-center text-emerald-600 font-medium text-sm">
					<span>{$_('home.landing.builder.title')}</span>
					<svg
						class="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform"
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M9 5l7 7-7 7"
						/>
					</svg>
				</div>
			</button>

			<!-- View Menu -->
			<button
				class="group bg-gray-900 border-2 border-gray-900 rounded-2xl p-8 text-left hover:bg-gray-800 hover:shadow-lg transition-all duration-200 cursor-pointer"
				onclick={onViewMenu}
			>
				<div class="text-4xl mb-4">📋</div>
				<h2 class="text-xl font-semibold text-white mb-2">{$_('home.landing.menu.title')}</h2>
				<p class="text-gray-400 text-sm leading-relaxed">{$_('home.landing.menu.description')}</p>
				<div class="mt-6 flex items-center text-emerald-400 font-medium text-sm">
					<span>{$_('home.landing.menu.title')}</span>
					<svg
						class="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform"
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M9 5l7 7-7 7"
						/>
					</svg>
				</div>
			</button>
		</div>
	</div>
</div>
