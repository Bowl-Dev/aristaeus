<script lang="ts">
	import { _ } from 'svelte-i18n';
	import { resolve } from '$app/paths';
</script>

<main class="min-h-screen bg-gray-50 py-8 px-4">
	<div class="max-w-3xl mx-auto bg-white rounded-xl shadow-sm p-6 md:p-8">
		<h1 class="text-3xl font-bold text-gray-900 mb-2">{$_('privacy.title')}</h1>
		<p class="text-sm text-gray-500 mb-8">
			{$_('privacy.lastUpdated', { values: { date: '2026-02-25' } })}
		</p>

		<!-- 1. Data Controller -->
		<section class="mb-8">
			<h2 class="text-xl font-semibold text-gray-800 mb-3">{$_('privacy.dataController.title')}</h2>
			<p class="text-gray-600 leading-relaxed">{$_('privacy.dataController.content')}</p>
		</section>

		<!-- 2. Purpose of Data Processing -->
		<section class="mb-8">
			<h2 class="text-xl font-semibold text-gray-800 mb-3">{$_('privacy.purpose.title')}</h2>
			<p class="text-gray-600 mb-3">{$_('privacy.purpose.content')}</p>
			<ul class="list-disc list-inside text-gray-600 space-y-1 ml-2">
				{#each $_('privacy.purpose.items') as item, i (i)}
					<li>{item}</li>
				{/each}
			</ul>
		</section>

		<!-- 3. Data Collected -->
		<section class="mb-8">
			<h2 class="text-xl font-semibold text-gray-800 mb-3">{$_('privacy.dataCollected.title')}</h2>
			<p class="text-gray-600 mb-3">{$_('privacy.dataCollected.content')}</p>
			<ul class="list-disc list-inside text-gray-600 space-y-1 ml-2">
				{#each $_('privacy.dataCollected.items') as item, i (i)}
					<li>{item}</li>
				{/each}
			</ul>
		</section>

		<!-- 4. Data Subject Rights -->
		<section class="mb-8">
			<h2 class="text-xl font-semibold text-gray-800 mb-3">{$_('privacy.rights.title')}</h2>
			<p class="text-gray-600 mb-3">{$_('privacy.rights.content')}</p>
			<ul class="list-disc list-inside text-gray-600 space-y-1 ml-2">
				{#each $_('privacy.rights.items') as item, i (i)}
					<li>{item}</li>
				{/each}
			</ul>
		</section>

		<!-- 5. Data Retention -->
		<section class="mb-8">
			<h2 class="text-xl font-semibold text-gray-800 mb-3">{$_('privacy.retention.title')}</h2>
			<p class="text-gray-600 leading-relaxed">{$_('privacy.retention.content')}</p>
		</section>

		<!-- 6. Security Measures -->
		<section class="mb-8">
			<h2 class="text-xl font-semibold text-gray-800 mb-3">{$_('privacy.security.title')}</h2>
			<p class="text-gray-600 leading-relaxed">{$_('privacy.security.content')}</p>
		</section>

		<!-- 7. How to Exercise Rights -->
		<section class="mb-8">
			<h2 class="text-xl font-semibold text-gray-800 mb-3">{$_('privacy.exerciseRights.title')}</h2>
			<p class="text-gray-600 mb-3">{$_('privacy.exerciseRights.content')}</p>
			<ul class="list-disc list-inside text-gray-600 space-y-1 ml-2">
				{#each $_('privacy.exerciseRights.items') as item, i (i)}
					<li>{item}</li>
				{/each}
			</ul>
			<div class="mt-4">
				<a
					href={resolve('/privacy/delete')}
					class="inline-flex items-center text-primary-600 hover:text-primary-700 font-medium"
				>
					{$_('privacy.deleteLink')}
					<svg class="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M9 5l7 7-7 7"
						/>
					</svg>
				</a>
			</div>
		</section>

		<!-- 8. Data Protection Authority -->
		<section class="mb-8">
			<h2 class="text-xl font-semibold text-gray-800 mb-3">{$_('privacy.complaints.title')}</h2>
			<p class="text-gray-600 leading-relaxed">{$_('privacy.complaints.content')}</p>
		</section>

		<!-- Back to home -->
		<div class="pt-6 border-t border-gray-200">
			<a href={resolve('/')} class="inline-flex items-center text-gray-600 hover:text-gray-800">
				<svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M15 19l-7-7 7-7"
					/>
				</svg>
				{$_('privacy.backToHome')}
			</a>
		</div>
	</div>
</main>
