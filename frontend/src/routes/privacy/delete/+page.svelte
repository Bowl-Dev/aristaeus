<script lang="ts">
	import { _ } from 'svelte-i18n';
	import { resolve } from '$app/paths';
	import { deleteUserData, ApiError } from '$lib/api/client';

	// Form state
	let phone = $state('');
	let confirmed = $state(false);
	let submitting = $state(false);
	let success = $state(false);
	let error = $state<string | null>(null);
	let ordersDeleted = $state(0);

	// Validation
	const isValidPhone = $derived(/^(\+57)?[0-9]{10}$/.test(phone.replace(/\s/g, '')));
	const canSubmit = $derived(isValidPhone && confirmed && !submitting);

	async function handleSubmit(e: Event) {
		e.preventDefault();
		if (!canSubmit) return;

		submitting = true;
		error = null;

		try {
			const result = await deleteUserData(phone.replace(/\s/g, ''));
			success = true;
			ordersDeleted = result.ordersDeleted || 0;
		} catch (e) {
			if (e instanceof ApiError) {
				if (e.status === 404) {
					error = $_('privacy.delete.errorNotFound');
				} else {
					error = e.message;
				}
			} else {
				error = 'An unexpected error occurred';
			}
		} finally {
			submitting = false;
		}
	}
</script>

<main class="min-h-screen bg-gray-50 py-8 px-4">
	<div class="max-w-xl mx-auto bg-white rounded-xl shadow-sm p-6 md:p-8">
		{#if success}
			<!-- Success State -->
			<div class="text-center py-8">
				<div
					class="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4"
				>
					<svg class="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M5 13l4 4L19 7"
						/>
					</svg>
				</div>
				<h1 class="text-2xl font-bold text-gray-900 mb-2">{$_('privacy.delete.successTitle')}</h1>
				<p class="text-gray-600 mb-6">{$_('privacy.delete.successMessage')}</p>
				{#if ordersDeleted > 0}
					<p class="text-sm text-gray-500 mb-6">
						{$_('privacy.delete.ordersDeleted', { values: { count: ordersDeleted } })}
					</p>
				{/if}
				<a
					href={resolve('/')}
					class="inline-flex items-center justify-center px-6 py-3 bg-primary-500 text-white rounded-lg font-medium hover:bg-primary-600 transition-colors"
				>
					{$_('privacy.backToHome')}
				</a>
			</div>
		{:else}
			<!-- Form State -->
			<h1 class="text-2xl font-bold text-gray-900 mb-2">{$_('privacy.delete.title')}</h1>
			<p class="text-gray-600 mb-6">{$_('privacy.delete.description')}</p>

			<!-- Warning -->
			<div class="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
				<div class="flex">
					<svg
						class="w-5 h-5 text-amber-600 mr-3 flex-shrink-0 mt-0.5"
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
						/>
					</svg>
					<p class="text-sm text-amber-800">{$_('privacy.delete.warning')}</p>
				</div>
			</div>

			<form onsubmit={handleSubmit} class="space-y-6">
				<!-- Phone Input -->
				<div>
					<label for="phone" class="block text-sm font-medium text-gray-700 mb-1">
						{$_('privacy.delete.phoneLabel')}
					</label>
					<input
						type="tel"
						id="phone"
						bind:value={phone}
						placeholder={$_('privacy.delete.phonePlaceholder')}
						class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
						class:border-red-300={phone.length > 0 && !isValidPhone}
					/>
					{#if phone.length > 0 && !isValidPhone}
						<p class="mt-1 text-sm text-red-600">{$_('privacy.delete.phoneInvalid')}</p>
					{/if}
				</div>

				<!-- Confirmation Checkbox -->
				<div class="flex items-start">
					<input
						type="checkbox"
						id="confirm"
						bind:checked={confirmed}
						class="mt-1 h-4 w-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
					/>
					<label for="confirm" class="ml-3 text-sm text-gray-600">
						{$_('privacy.delete.confirmLabel')}
					</label>
				</div>

				<!-- Error Message -->
				{#if error}
					<div class="bg-red-50 border border-red-200 rounded-lg p-4">
						<p class="text-sm text-red-700">{error}</p>
					</div>
				{/if}

				<!-- Submit Button -->
				<button
					type="submit"
					disabled={!canSubmit}
					class="w-full py-3 px-4 bg-red-600 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed hover:bg-red-700"
				>
					{#if submitting}
						{$_('privacy.delete.submitting')}
					{:else}
						{$_('privacy.delete.submit')}
					{/if}
				</button>
			</form>

			<!-- Back Link -->
			<div class="mt-6 pt-6 border-t border-gray-200">
				<a
					href={resolve('/privacy')}
					class="inline-flex items-center text-gray-600 hover:text-gray-800"
				>
					<svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M15 19l-7-7 7-7"
						/>
					</svg>
					{$_('privacy.delete.backToPrivacy')}
				</a>
			</div>
		{/if}
	</div>
</main>
