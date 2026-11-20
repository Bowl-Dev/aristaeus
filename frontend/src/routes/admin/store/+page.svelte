<script lang="ts">
	import { resolve } from '$app/paths';
	import { _ } from 'svelte-i18n';
	import { getConfig, updateStoreConfig, ApiError } from '$lib/api/client';
	import type { StoreConfigResponse, WeeklyHours } from '$lib/types';
	import { readToken, saveToken } from '$lib/utils/adminToken';

	let token = $state(readToken());
	let tokenInput = $state('');
	let tokenRejected = $state(false);

	let config = $state<StoreConfigResponse | null>(null);
	// Editable copy of config.weeklyHours, saved with the hours form.
	let hours = $state<WeeklyHours>({});
	let error = $state<string | null>(null);
	let message = $state<string | null>(null);
	let saving = $state(false);

	const WEEK = [1, 2, 3, 4, 5, 6, 0]; // Monday first
	const days = $derived($_('store.days') as unknown as string[]);

	// Any 401 means the stored token is wrong: forget it and ask again.
	function handleError(e: unknown) {
		if (e instanceof ApiError && e.status === 401) {
			saveToken('');
			token = '';
			tokenRejected = true;
		} else {
			error = `${$_('admin.store.saveFailed')} ${e instanceof ApiError ? e.message : ''}`.trim();
		}
	}

	function apply(next: StoreConfigResponse) {
		config = next;
		hours = structuredClone(next.weeklyHours);
	}

	$effect(() => {
		if (!token) return;
		getConfig()
			.then(apply)
			.catch(() => (error = $_('admin.store.loadFailed')));
	});

	function submitToken(e: SubmitEvent) {
		e.preventDefault();
		const t = tokenInput.trim();
		if (!t) return;
		saveToken(t);
		tokenRejected = false;
		tokenInput = '';
		token = t;
	}

	async function save(patch: Partial<StoreConfigResponse>) {
		saving = true;
		error = null;
		message = null;
		try {
			apply(await updateStoreConfig(patch, token));
			message = $_('admin.store.saved');
		} catch (e) {
			handleError(e);
		} finally {
			saving = false;
		}
	}

	function saveHours(e: SubmitEvent) {
		e.preventDefault();
		save({ weeklyHours: hours });
	}

	const inputClass =
		'px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent';
	const smallButton =
		'px-3 py-1.5 bg-white border border-gray-200 rounded-xl text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50';
	const primaryButton =
		'px-4 py-2 bg-gray-900 text-white rounded-xl text-sm font-semibold hover:bg-gray-800 transition-colors disabled:opacity-50';
</script>

<main class="min-h-dvh bg-gray-50 p-4 md:p-8">
	<div class="max-w-3xl mx-auto">
		<header class="bg-white border border-gray-200 rounded-xl p-4 sm:p-6 mb-6">
			<div class="flex flex-col gap-4">
				<div>
					<h1 class="text-2xl sm:text-3xl font-bold text-gray-900">{$_('admin.store.title')}</h1>
					<p class="text-sm text-gray-500 mt-1">{$_('admin.store.subtitle')}</p>
				</div>
				<div class="flex flex-wrap items-center gap-3">
					<a
						href={resolve('/admin')}
						class="px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
					>
						{$_('admin.hub.backToHub')}
					</a>
					{#if token}
						<button
							class="px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
							onclick={() => {
								saveToken('');
								token = '';
							}}
						>
							{$_('admin.coupons.auth.signOut')}
						</button>
					{/if}
				</div>
			</div>
		</header>

		{#if !token}
			<form
				class="bg-white border border-gray-200 rounded-xl p-6 max-w-md flex flex-col gap-4"
				onsubmit={submitToken}
			>
				<h2 class="text-lg font-semibold text-gray-900">{$_('admin.coupons.auth.title')}</h2>
				<label class="flex flex-col gap-1 text-sm font-medium text-gray-700">
					{$_('admin.coupons.auth.label')}
					<input
						type="password"
						autocomplete="current-password"
						class={inputClass}
						bind:value={tokenInput}
					/>
				</label>
				{#if tokenRejected}
					<p class="text-sm text-red-600">{$_('admin.coupons.auth.invalid')}</p>
				{/if}
				<button type="submit" class={primaryButton}>{$_('admin.coupons.auth.submit')}</button>
			</form>
		{:else}
			{#if error}
				<p class="mb-4 text-sm text-red-600" role="alert">{error}</p>
			{/if}
			{#if message}
				<p class="mb-4 text-sm text-green-700" role="status">{message}</p>
			{/if}

			{#if config}
				<section class="bg-white border border-gray-200 rounded-xl p-4 sm:p-6 mb-6">
					<h2 class="text-lg font-semibold text-gray-900 mb-3">{$_('admin.store.status.title')}</h2>
					<div class="flex flex-wrap items-center justify-between gap-3">
						<p
							class="text-sm font-medium {config.ordersPaused ? 'text-red-600' : 'text-green-700'}"
						>
							{config.ordersPaused
								? $_('admin.store.status.paused')
								: $_('admin.store.status.open')}
						</p>
						<button
							class={primaryButton}
							disabled={saving}
							onclick={() => save({ ordersPaused: !config?.ordersPaused })}
						>
							{config.ordersPaused
								? $_('admin.store.status.reopen')
								: $_('admin.store.status.close')}
						</button>
					</div>
				</section>

				<form
					class="bg-white border border-gray-200 rounded-xl p-4 sm:p-6 flex flex-col gap-4"
					onsubmit={saveHours}
				>
					<h2 class="text-lg font-semibold text-gray-900">{$_('admin.store.hours.title')}</h2>
					{#each WEEK as day (day)}
						{@const ranges = hours[day] ?? []}
						<div
							class="flex flex-col gap-2 border-b border-gray-100 pb-3 sm:flex-row sm:items-start"
						>
							<span class="w-16 pt-2 text-sm font-semibold text-gray-900">{days[day]}</span>
							<div class="flex flex-1 flex-col gap-2">
								{#each ranges as range, i (i)}
									<div class="flex flex-wrap items-center gap-2">
										<input
											type="time"
											class={inputClass}
											aria-label="{days[day]} {$_('admin.store.hours.from')}"
											bind:value={range[0]}
											required
										/>
										<span class="text-gray-500">–</span>
										<input
											type="time"
											class={inputClass}
											aria-label="{days[day]} {$_('admin.store.hours.to')}"
											bind:value={range[1]}
											min={range[0]}
											required
										/>
										<button
											type="button"
											class={smallButton}
											aria-label={$_('admin.store.hours.removeRange')}
											onclick={() => (hours[day] = ranges.filter((_r, j) => j !== i))}
										>
											✕
										</button>
									</div>
								{:else}
									<p class="pt-2 text-sm text-gray-500">{$_('admin.store.hours.closedDay')}</p>
								{/each}
								{#if ranges.length < 2}
									<button
										type="button"
										class="{smallButton} self-start"
										onclick={() => (hours[day] = [...ranges, ['09:00', '17:00']])}
									>
										{$_('admin.store.hours.addRange')}
									</button>
								{/if}
							</div>
						</div>
					{/each}
					<button type="submit" class="{primaryButton} self-start" disabled={saving}>
						{saving ? $_('admin.store.hours.saving') : $_('admin.store.hours.save')}
					</button>
				</form>
			{/if}
		{/if}
	</div>
</main>
