<script lang="ts">
	import { resolve } from '$app/paths';
	import { _ } from 'svelte-i18n';
	import { listCoupons, createCoupon, updateCoupon, deleteCoupon, ApiError } from '$lib/api/client';
	import type { CouponRecord, CouponType } from '$lib/types';
	import { couponStatus } from '$lib/utils/coupons';
	import { formatCOP } from '$lib/utils/bowl';

	const TOKEN_KEY = 'aristaeus.adminToken';

	function readToken(): string {
		try {
			return localStorage.getItem(TOKEN_KEY) ?? '';
		} catch {
			return '';
		}
	}

	function saveToken(value: string) {
		try {
			if (value) localStorage.setItem(TOKEN_KEY, value);
			else localStorage.removeItem(TOKEN_KEY);
		} catch {
			// Storage blocked: the token just lives for this page view.
		}
	}

	let token = $state(readToken());
	let tokenInput = $state('');
	let tokenRejected = $state(false);

	let coupons = $state<CouponRecord[]>([]);
	let loading = $state(false);
	let error = $state<string | null>(null);
	let togglingId = $state<number | null>(null);
	let deletingId = $state<number | null>(null);

	// Create / edit form. `editing` is the coupon being edited; null means create mode.
	let editing = $state<CouponRecord | null>(null);
	// Code, type and value can't change once a checkout has used the coupon.
	const locked = $derived((editing?.redemptions ?? 0) > 0);
	let campaignName = $state('');
	let code = $state('');
	let description = $state('');
	let type = $state<CouponType>('percent');
	let value = $state<number | null>(null);
	let startDate = $state('');
	let endDate = $state('');
	let budgetTotal = $state<number | null>(null);
	let minBowls = $state(1);
	let firstPurchaseOnly = $state(false);
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

	async function loadCoupons() {
		loading = true;
		error = null;
		try {
			coupons = (await listCoupons(token)).coupons;
		} catch (e) {
			if (!handleAuthError(e)) error = $_('admin.coupons.loadFailed');
		} finally {
			loading = false;
		}
	}

	$effect(() => {
		if (token) loadCoupons();
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

	const KNOWN_ERRORS = ['coupon_in_use', 'coupon_code_taken', 'budget_below_redeemed'];

	// Server error codes we have copy for; anything else is appended to the fallback.
	function errorText(e: unknown, fallbackKey: string): string {
		const reason = e instanceof ApiError ? e.message : '';
		return KNOWN_ERRORS.includes(reason)
			? $_(`admin.coupons.errors.${reason}`)
			: `${$_(fallbackKey)} ${reason}`.trim();
	}

	// yyyy-mm-dd of an instant in Bogotá time, for <input type="date">.
	const bogotaDate = (iso: string) =>
		new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date(iso));

	function resetForm() {
		editing = null;
		code = '';
		campaignName = '';
		description = '';
		value = null;
	}

	function startEdit(c: CouponRecord) {
		editing = c;
		code = c.code;
		campaignName = c.campaignName;
		description = c.description ?? '';
		type = c.type;
		value = c.value;
		startDate = bogotaDate(c.startsAt);
		endDate = bogotaDate(c.endsAt);
		budgetTotal = c.budgetTotal;
		minBowls = c.minBowls;
		firstPurchaseOnly = c.firstPurchaseOnly;
		active = c.active;
		saveMessage = null;
		saveError = null;
		window.scrollTo({ top: 0, behavior: 'smooth' });
	}

	async function submitCoupon(e: SubmitEvent) {
		e.preventDefault();
		saving = true;
		saveMessage = null;
		saveError = null;
		const fields = {
			code: code.trim(),
			campaignName: campaignName.trim(),
			type,
			// Bogotá has no DST, so -05:00 is always right.
			startsAt: `${startDate}T00:00:00-05:00`,
			endsAt: `${endDate}T23:59:59-05:00`,
			budgetTotal: budgetTotal ?? 0,
			minBowls,
			firstPurchaseOnly,
			active
		};
		try {
			if (editing) {
				// Full field set: unchanged locked fields pass the server's in-use check.
				const updated = await updateCoupon(
					editing.id,
					{
						...fields,
						description: description.trim() || null,
						value: type === 'free_shipping' ? null : value
					},
					token
				);
				coupons = coupons.map((c) => (c.id === updated.id ? updated : c));
				saveMessage = $_('admin.coupons.form.updated', { values: { code: updated.code } });
			} else {
				const created = await createCoupon(
					{
						...fields,
						description: description.trim() || undefined,
						value: type === 'free_shipping' ? undefined : (value ?? undefined)
					},
					token
				);
				coupons = [created, ...coupons];
				saveMessage = $_('admin.coupons.form.saved', { values: { code: created.code } });
			}
			resetForm();
		} catch (e) {
			if (!handleAuthError(e)) saveError = errorText(e, 'admin.coupons.saveFailed');
		} finally {
			saving = false;
		}
	}

	async function removeCoupon(c: CouponRecord) {
		if (!confirm($_('admin.coupons.list.confirmDelete', { values: { code: c.code } }))) return;
		deletingId = c.id;
		error = null;
		try {
			await deleteCoupon(c.id, token);
			if (editing?.id === c.id) resetForm();
			await loadCoupons();
		} catch (e) {
			if (!handleAuthError(e)) error = errorText(e, 'admin.coupons.deleteFailed');
		} finally {
			deletingId = null;
		}
	}

	async function toggleActive(coupon: CouponRecord) {
		togglingId = coupon.id;
		try {
			await updateCoupon(coupon.id, { active: !coupon.active }, token);
			coupons = coupons.map((c) => (c.id === coupon.id ? { ...c, active: !coupon.active } : c));
		} catch (e) {
			if (!handleAuthError(e)) error = $_('admin.coupons.toggleFailed');
		} finally {
			togglingId = null;
		}
	}

	function benefit(c: CouponRecord): string {
		if (c.type === 'percent') return `${c.value}%`;
		if (c.type === 'fixed') return formatCOP(c.value ?? 0);
		return $_('admin.coupons.type.free_shipping');
	}

	const dateFmt = new Intl.DateTimeFormat('es-CO', {
		timeZone: 'America/Bogota',
		day: '2-digit',
		month: 'short',
		year: 'numeric'
	});

	const statusColors: Record<string, string> = {
		live: 'bg-green-500 text-white',
		scheduled: 'bg-blue-500 text-white',
		expired: 'bg-gray-400 text-white',
		exhausted: 'bg-amber-500 text-black',
		inactive: 'bg-gray-200 text-gray-700'
	};

	const inputClass =
		'w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent';
	const labelClass = 'flex flex-col gap-1 text-sm font-medium text-gray-700';
</script>

<main class="min-h-dvh bg-gray-50 p-4 md:p-8">
	<div class="max-w-7xl mx-auto">
		<header class="bg-white border border-gray-200 rounded-xl p-4 sm:p-6 mb-6">
			<div class="flex flex-col gap-4">
				<div>
					<h1 class="text-2xl sm:text-3xl font-bold text-gray-900">
						{$_('admin.coupons.title')}
					</h1>
					<p class="text-sm text-gray-500 mt-1">{$_('admin.coupons.subtitle')}</p>
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
				onsubmit={submitCoupon}
			>
				<h2 class="text-lg font-semibold text-gray-900">
					{editing
						? $_('admin.coupons.form.editTitle', { values: { code: editing.code } })
						: $_('admin.coupons.form.title')}
				</h2>
				{#if locked}
					<p class="text-sm text-amber-700">{$_('admin.coupons.form.lockedHint')}</p>
				{/if}
				<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
					<label class={labelClass}>
						{$_('admin.coupons.form.campaign')}
						<input class={inputClass} bind:value={campaignName} required />
					</label>
					<label class={labelClass}>
						{$_('admin.coupons.form.code')}
						<input
							class="{inputClass} uppercase"
							value={code}
							oninput={(e) => (code = e.currentTarget.value.toUpperCase())}
							pattern={'[A-Z0-9_\\-]{3,40}'}
							disabled={locked}
							required
						/>
					</label>
					<label class="{labelClass} sm:col-span-2">
						{$_('admin.coupons.form.description')}
						<textarea class={inputClass} rows="2" bind:value={description}></textarea>
					</label>
					<label class={labelClass}>
						{$_('admin.coupons.form.type')}
						<select class={inputClass} bind:value={type} disabled={locked}>
							<option value="percent">{$_('admin.coupons.type.percent')}</option>
							<option value="fixed">{$_('admin.coupons.type.fixed')}</option>
							<option value="free_shipping">{$_('admin.coupons.type.free_shipping')}</option>
						</select>
					</label>
					{#if type === 'free_shipping'}
						<p class="text-sm text-gray-500 self-end">
							{$_('admin.coupons.form.freeShippingNote')}
						</p>
					{:else}
						<label class={labelClass}>
							{type === 'percent'
								? $_('admin.coupons.form.percent')
								: $_('admin.coupons.form.amount')}
							<input
								type="number"
								class={inputClass}
								bind:value
								min="1"
								max={type === 'percent' ? 100 : undefined}
								step="1"
								disabled={locked}
								required
							/>
						</label>
					{/if}
					<label class={labelClass}>
						{$_('admin.coupons.form.startsAt')}
						<input type="date" class={inputClass} bind:value={startDate} required />
					</label>
					<label class={labelClass}>
						{$_('admin.coupons.form.endsAt')}
						<input
							type="date"
							class={inputClass}
							bind:value={endDate}
							min={startDate || undefined}
							required
						/>
					</label>
					<label class={labelClass}>
						{$_('admin.coupons.form.budget')}
						<input
							type="number"
							class={inputClass}
							bind:value={budgetTotal}
							min="1"
							step="1"
							required
						/>
						<span class="text-xs font-normal text-gray-500">
							{$_('admin.coupons.form.budgetHint')}
						</span>
					</label>
					<label class={labelClass}>
						{$_('admin.coupons.form.minBowls')}
						<input
							type="number"
							class={inputClass}
							bind:value={minBowls}
							min="1"
							step="1"
							required
						/>
					</label>
					<label class="flex items-center gap-2 text-sm text-gray-700">
						<input type="checkbox" bind:checked={firstPurchaseOnly} />
						{$_('admin.coupons.form.firstPurchaseOnly')}
					</label>
					<label class="flex items-center gap-2 text-sm text-gray-700">
						<input type="checkbox" bind:checked={active} />
						{$_('admin.coupons.form.active')}
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
							? $_('admin.coupons.form.saving')
							: editing
								? $_('admin.coupons.form.update')
								: $_('admin.coupons.form.submit')}
					</button>
					{#if editing}
						<button
							type="button"
							class="px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50"
							onclick={resetForm}
						>
							{$_('admin.coupons.form.cancel')}
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
					{$_('admin.coupons.list.title')}
				</h2>
				{#if loading && coupons.length === 0}
					<p class="p-6 text-sm text-gray-500">{$_('admin.coupons.list.loading')}</p>
				{:else if coupons.length === 0}
					<p class="p-6 text-sm text-gray-500">{$_('admin.coupons.list.empty')}</p>
				{:else}
					<table class="w-full text-sm mt-4">
						<thead class="text-left text-xs uppercase tracking-wide text-gray-500 bg-gray-50">
							<tr>
								<th class="px-4 py-2">{$_('admin.coupons.list.code')}</th>
								<th class="px-4 py-2">{$_('admin.coupons.list.benefit')}</th>
								<th class="px-4 py-2">{$_('admin.coupons.list.window')}</th>
								<th class="px-4 py-2">{$_('admin.coupons.list.budget')}</th>
								<th class="px-4 py-2">{$_('admin.coupons.list.redemptions')}</th>
								<th class="px-4 py-2">{$_('admin.coupons.list.status')}</th>
								<th class="px-4 py-2"></th>
							</tr>
						</thead>
						<tbody class="divide-y divide-gray-100">
							{#each coupons as c (c.id)}
								{@const status = couponStatus(c)}
								<tr>
									<td class="px-4 py-3">
										<p class="font-bold text-gray-900">{c.code}</p>
										<p class="text-xs text-gray-500">{c.campaignName}</p>
									</td>
									<td class="px-4 py-3">
										<p>{benefit(c)}</p>
										{#if c.minBowls > 1}
											<p class="text-xs text-gray-500">
												{$_('admin.coupons.list.minBowls', { values: { count: c.minBowls } })}
											</p>
										{/if}
										{#if c.firstPurchaseOnly}
											<p class="text-xs text-gray-500">{$_('admin.coupons.list.firstOnly')}</p>
										{/if}
									</td>
									<td class="px-4 py-3 whitespace-nowrap">
										{dateFmt.format(new Date(c.startsAt))} – {dateFmt.format(new Date(c.endsAt))}
									</td>
									<td class="px-4 py-3 whitespace-nowrap">
										{formatCOP(c.budgetRemaining)} / {formatCOP(c.budgetTotal)}
									</td>
									<td class="px-4 py-3">{c.redemptions}</td>
									<td class="px-4 py-3">
										<span
											class="px-2.5 py-1 {statusColors[
												status
											]} text-xs font-semibold uppercase rounded-full whitespace-nowrap"
										>
											{$_(`admin.coupons.status.${status}`)}
										</span>
									</td>
									<td class="px-4 py-3 text-right whitespace-nowrap">
										<button
											class="px-3 py-1.5 bg-white border border-gray-200 rounded-xl text-xs font-medium text-gray-700 hover:bg-gray-50"
											onclick={() => startEdit(c)}
										>
											{$_('admin.coupons.list.edit')}
										</button>
										<button
											class="px-3 py-1.5 bg-white border border-red-200 rounded-xl text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
											disabled={c.redemptions > 0 || deletingId === c.id}
											title={c.redemptions > 0
												? $_('admin.coupons.errors.coupon_in_use')
												: undefined}
											onclick={() => removeCoupon(c)}
										>
											{$_('admin.coupons.list.delete')}
										</button>
										<button
											class="px-3 py-1.5 bg-white border border-gray-200 rounded-xl text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
											disabled={togglingId === c.id}
											onclick={() => toggleActive(c)}
										>
											{c.active
												? $_('admin.coupons.list.deactivate')
												: $_('admin.coupons.list.activate')}
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
