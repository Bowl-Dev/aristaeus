<script lang="ts">
	import { resolve } from '$app/paths';
	import { _ } from 'svelte-i18n';
	import { getPickupPoints, createPickupPoint, updatePickupPoint, ApiError } from '$lib/api/client';
	import type { PickupPoint } from '$lib/types';
	import { readToken, saveToken } from '$lib/utils/adminToken';

	let token = $state(readToken());
	let tokenInput = $state('');
	let tokenRejected = $state(false);

	let points = $state<PickupPoint[]>([]);
	let loading = $state(false);
	let error = $state<string | null>(null);
	let togglingId = $state<number | null>(null);

	// Create / edit form. `editing` is the point being edited; null means create mode.
	let editing = $state<PickupPoint | null>(null);
	let name = $state('');
	let location = $state('');
	let hours = $state('');
	let displayOrder = $state<number | null>(null);
	let active = $state(true);
	let saving = $state(false);
	let saveMessage = $state<string | null>(null);
	let saveError = $state<string | null>(null);

	// Any 401 means the stored token is wrong: forget it and ask again.
	function handleAuthError(e: unknown): boolean {
		if (e instanceof ApiError && e.status === 401) {
			saveToken('');
			token = '';
			tokenRejected = true;
			return true;
		}
		return false;
	}

	async function loadPoints() {
		loading = true;
		error = null;
		try {
			points = await getPickupPoints();
		} catch {
			error = $_('admin.pickupPoints.loadFailed');
		} finally {
			loading = false;
		}
	}

	$effect(() => {
		if (token) loadPoints();
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

	function resetForm() {
		editing = null;
		name = '';
		location = '';
		hours = '';
		displayOrder = null;
		active = true;
	}

	function startEdit(p: PickupPoint) {
		editing = p;
		name = p.name;
		location = p.location;
		hours = p.hours;
		displayOrder = p.displayOrder;
		active = p.active;
		saveMessage = null;
		saveError = null;
		window.scrollTo({ top: 0, behavior: 'smooth' });
	}

	async function submitPoint(e: SubmitEvent) {
		e.preventDefault();
		saving = true;
		saveMessage = null;
		saveError = null;
		const fields = {
			name: name.trim(),
			location: location.trim(),
			hours: hours.trim(),
			// An emptied number input binds as null or undefined.
			displayOrder: displayOrder ?? null,
			active
		};
		try {
			if (editing) {
				const updated = await updatePickupPoint(editing.id, fields, token);
				points = points.map((p) => (p.id === updated.id ? updated : p));
				saveMessage = $_('admin.pickupPoints.form.updated', { values: { name: updated.name } });
			} else {
				const created = await createPickupPoint(fields, token);
				points = [...points, created];
				saveMessage = $_('admin.pickupPoints.form.saved', { values: { name: created.name } });
			}
			resetForm();
		} catch (e) {
			if (!handleAuthError(e))
				saveError =
					`${$_('admin.pickupPoints.saveFailed')} ${e instanceof ApiError ? e.message : ''}`.trim();
		} finally {
			saving = false;
		}
	}

	async function toggleActive(point: PickupPoint) {
		togglingId = point.id;
		try {
			const updated = await updatePickupPoint(point.id, { active: !point.active }, token);
			points = points.map((p) => (p.id === updated.id ? updated : p));
		} catch (e) {
			if (!handleAuthError(e)) error = $_('admin.pickupPoints.toggleFailed');
		} finally {
			togglingId = null;
		}
	}

	const inputClass =
		'w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent';
	const labelClass = 'flex flex-col gap-1 text-sm font-medium text-gray-700';
	const smallButton =
		'px-3 py-1.5 bg-white border border-gray-200 rounded-xl text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50';
</script>

<main class="min-h-dvh bg-gray-50 p-4 md:p-8">
	<div class="max-w-7xl mx-auto">
		<header class="bg-white border border-gray-200 rounded-xl p-4 sm:p-6 mb-6">
			<div class="flex flex-col gap-4">
				<div>
					<h1 class="text-2xl sm:text-3xl font-bold text-gray-900">
						{$_('admin.pickupPoints.title')}
					</h1>
					<p class="text-sm text-gray-500 mt-1">{$_('admin.pickupPoints.subtitle')}</p>
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
				<label class={labelClass}>
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
				<button
					type="submit"
					class="px-4 py-2 bg-gray-900 text-white rounded-xl text-sm font-semibold hover:bg-gray-800 transition-colors"
				>
					{$_('admin.coupons.auth.submit')}
				</button>
			</form>
		{:else}
			<form
				class="bg-white border border-gray-200 rounded-xl p-4 sm:p-6 mb-6 flex flex-col gap-4"
				onsubmit={submitPoint}
			>
				<h2 class="text-lg font-semibold text-gray-900">
					{editing
						? $_('admin.pickupPoints.form.editTitle', { values: { name: editing.name } })
						: $_('admin.pickupPoints.form.title')}
				</h2>
				<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
					<label class={labelClass}>
						{$_('admin.pickupPoints.form.name')}
						<input class={inputClass} bind:value={name} maxlength="100" required />
					</label>
					<label class={labelClass}>
						{$_('admin.pickupPoints.form.location')}
						<input class={inputClass} bind:value={location} maxlength="200" required />
					</label>
					<label class={labelClass}>
						{$_('admin.pickupPoints.form.hours')}
						<input
							class={inputClass}
							bind:value={hours}
							maxlength="100"
							placeholder={$_('admin.pickupPoints.form.hoursPlaceholder')}
							required
						/>
					</label>
					<label class={labelClass}>
						{$_('admin.pickupPoints.form.displayOrder')}
						<input type="number" class={inputClass} bind:value={displayOrder} step="1" />
					</label>
					<label class="flex items-center gap-2 text-sm text-gray-700">
						<input type="checkbox" bind:checked={active} />
						{$_('admin.pickupPoints.form.active')}
					</label>
				</div>
				{#if saveMessage}
					<p class="text-sm text-green-700">{saveMessage}</p>
				{/if}
				{#if saveError}
					<p class="text-sm text-red-600">{saveError}</p>
				{/if}
				<div class="flex gap-3">
					<button
						type="submit"
						class="px-4 py-2 bg-gray-900 text-white rounded-xl text-sm font-semibold hover:bg-gray-800 transition-colors disabled:opacity-50"
						disabled={saving}
					>
						{saving
							? $_('admin.pickupPoints.form.saving')
							: editing
								? $_('admin.pickupPoints.form.update')
								: $_('admin.pickupPoints.form.submit')}
					</button>
					{#if editing}
						<button
							type="button"
							class="px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50"
							onclick={resetForm}
						>
							{$_('admin.pickupPoints.form.cancel')}
						</button>
					{/if}
				</div>
			</form>

			{#if error}
				<div class="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
					<p class="text-red-600 text-sm">{error}</p>
				</div>
			{/if}

			<div class="bg-white border border-gray-200 rounded-xl overflow-x-auto">
				<h2 class="text-lg font-semibold text-gray-900 p-4 sm:p-6 pb-0 sm:pb-0">
					{$_('admin.pickupPoints.list.title')}
				</h2>
				{#if loading && points.length === 0}
					<p class="p-6 text-sm text-gray-500">{$_('admin.pickupPoints.list.loading')}</p>
				{:else if points.length === 0}
					<p class="p-6 text-sm text-gray-500">{$_('admin.pickupPoints.list.empty')}</p>
				{:else}
					<table class="w-full text-sm mt-4">
						<thead class="text-left text-xs uppercase tracking-wide text-gray-500 bg-gray-50">
							<tr>
								<th class="px-4 py-2">{$_('admin.pickupPoints.list.point')}</th>
								<th class="px-4 py-2">{$_('admin.pickupPoints.form.hours')}</th>
								<th class="px-4 py-2">{$_('admin.pickupPoints.form.displayOrder')}</th>
								<th class="px-4 py-2">{$_('admin.pickupPoints.list.status')}</th>
								<th class="px-4 py-2"></th>
							</tr>
						</thead>
						<tbody class="divide-y divide-gray-100">
							{#each points as p (p.id)}
								<tr>
									<td class="px-4 py-3">
										<p class="font-bold text-gray-900">{p.name}</p>
										<p class="text-xs text-gray-500">{p.location}</p>
									</td>
									<td class="px-4 py-3">{p.hours}</td>
									<td class="px-4 py-3">{p.displayOrder ?? '—'}</td>
									<td class="px-4 py-3">
										<span
											class="px-2.5 py-1 text-xs font-semibold uppercase rounded-full whitespace-nowrap {p.active
												? 'bg-green-500 text-white'
												: 'bg-gray-200 text-gray-700'}"
										>
											{p.active
												? $_('admin.pickupPoints.list.active')
												: $_('admin.pickupPoints.list.inactive')}
										</span>
									</td>
									<td class="px-4 py-3 text-right whitespace-nowrap">
										<button class={smallButton} onclick={() => startEdit(p)}>
											{$_('admin.pickupPoints.list.edit')}
										</button>
										<button
											class={smallButton}
											disabled={togglingId === p.id}
											onclick={() => toggleActive(p)}
										>
											{p.active
												? $_('admin.pickupPoints.list.deactivate')
												: $_('admin.pickupPoints.list.activate')}
										</button>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				{/if}
			</div>
		{/if}
	</div>
</main>
