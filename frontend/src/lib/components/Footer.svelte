<script lang="ts">
	import { _ } from 'svelte-i18n';
	import { resolve } from '$app/paths';
</script>

<footer class="bg-gray-100 border-t border-gray-200 py-4 px-6 mt-auto">
	<div class="max-w-4xl mx-auto">
		<div class="flex flex-col sm:flex-row justify-between items-center gap-2 text-sm text-gray-500">
			<p>{$_('footer.copyright', { values: { year: new Date().getFullYear() } })}</p>
			<a
				href={resolve('/privacy')}
				class="text-gray-600 hover:text-gray-800 underline underline-offset-2"
			>
				{$_('footer.privacyPolicy')}
			</a>
		</div>
		<p class="text-xs text-gray-400 text-center mt-3">
			{$_('footer.implicitConsent')}
		</p>
	</div>
</footer>
