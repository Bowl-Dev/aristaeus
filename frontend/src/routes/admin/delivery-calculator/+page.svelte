<script lang="ts">
	import { resolve } from '$app/paths';
	import { _ } from 'svelte-i18n';
	import { onMount } from 'svelte';
	import { formatCOP } from '$lib/utils/bowl';
	import {
		ApiError,
		createDeliveryObservation,
		deleteDeliveryObservation,
		estimateDelivery,
		listDeliveryObservations,
		type DeliveryEstimateResponse,
		type DeliveryMatchTier,
		type DeliveryObservationsResponse
	} from '$lib/api/client';
	import {
		hasLegacyCorrections,
		migrateLegacyCorrections,
		readLegacyCorrections
	} from '$lib/utils/deliveryCalibration';

	/** The kitchen every distance is measured from. */
	const KITCHEN_ADDRESS = 'Calle 125 # 18A-05';

	/**
	 * How loudly a match tier must be presented.
	 *
	 * `medium` and `low` are not decorative distinctions: below `nearest_number`
	 * the exact address was never found, and the previous version of this page
	 * hid exactly that behind a confident-looking number.
	 */
	type Level = 'high' | 'good' | 'medium' | 'low';

	const TIER_LEVEL: Record<DeliveryMatchTier, Level> = {
		exact: 'high',
		nearest_number: 'good',
		nearest_cross: 'medium',
		street_segment: 'low',
		grid_fallback: 'low',
		failed: 'low'
	};

	/** Match tier -> i18n key segment. */
	const TIER_KEY: Record<DeliveryMatchTier, string> = {
		exact: 'exact',
		nearest_number: 'nearestNumber',
		nearest_cross: 'nearestCross',
		street_segment: 'streetSegment',
		grid_fallback: 'gridFallback',
		failed: 'failed'
	};

	// Address lookup
	let addressInput = $state('');
	let result = $state<DeliveryEstimateResponse | null>(null);
	let estimating = $state(false);
	let estimateError = $state<string | null>(null);

	// Recording what the courier really charged
	let actualCost = $state('');
	let savingCost = $state(false);
	let feedbackMessage = $state<string | null>(null);
	let feedbackError = $state<string | null>(null);

	// Shared, server-side training set
	let calibration = $state<DeliveryObservationsResponse | null>(null);
	let calibrationError = $state<string | null>(null);

	// One-time migration of the retired localStorage store
	let legacyCount = $state(0);
	let migrating = $state(false);
	let migrationMessage = $state<string | null>(null);

	onMount(() => {
		legacyCount = hasLegacyCorrections() ? readLegacyCorrections().length : 0;
		void loadCalibration();
	});

	async function loadCalibration() {
		calibrationError = null;
		try {
			calibration = await listDeliveryObservations();
		} catch (e) {
			calibrationError =
				e instanceof ApiError ? e.message : $_('admin.deliveryCalculator.calibration.loadError');
		}
	}

	async function runEstimate() {
		const address = addressInput.trim();
		if (!address) {
			estimateError = $_('admin.deliveryCalculator.error.empty');
			return;
		}

		estimating = true;
		estimateError = null;
		feedbackMessage = null;
		feedbackError = null;
		try {
			result = await estimateDelivery(address);
		} catch (e) {
			result = null;
			estimateError =
				e instanceof ApiError ? e.message : $_('admin.deliveryCalculator.error.generic');
		} finally {
			estimating = false;
		}
	}

	function handleSubmit(event: SubmitEvent) {
		event.preventDefault();
		void runEstimate();
	}

	async function saveActualCost() {
		const value = Number(actualCost);
		const address = addressInput.trim();
		if (!address || !Number.isFinite(value) || value <= 0) return;

		savingCost = true;
		feedbackError = null;
		feedbackMessage = null;
		try {
			await createDeliveryObservation({ address, actualCost: Math.round(value) });
			actualCost = '';
			await loadCalibration();
			// Re-price with the newly fitted model so the operator sees the shift.
			// This clears the feedback slot, so the confirmation is set afterwards.
			await runEstimate();
			feedbackMessage = $_('admin.deliveryCalculator.feedback.saved');
		} catch (e) {
			feedbackError =
				e instanceof ApiError ? e.message : $_('admin.deliveryCalculator.feedback.error');
		} finally {
			savingCost = false;
		}
	}

	async function handleRemove(id: number) {
		if (!confirm($_('admin.deliveryCalculator.calibration.removeConfirm'))) return;
		try {
			await deleteDeliveryObservation(id);
			await loadCalibration();
		} catch (e) {
			calibrationError =
				e instanceof ApiError ? e.message : $_('admin.deliveryCalculator.calibration.loadError');
		}
	}

	async function runMigration() {
		migrating = true;
		migrationMessage = null;
		try {
			const outcome = await migrateLegacyCorrections();
			migrationMessage = outcome.cleared
				? $_('admin.deliveryCalculator.migration.done', { values: { count: outcome.uploaded } })
				: $_('admin.deliveryCalculator.migration.failed', { values: { failed: outcome.failed } });
			legacyCount = readLegacyCorrections().length;
			await loadCalibration();
		} finally {
			migrating = false;
		}
	}

	const tier = $derived<DeliveryMatchTier | null>(result ? result.matchTier : null);
	const level = $derived<Level | null>(tier ? TIER_LEVEL[tier] : null);
	const tierKey = $derived(tier ? TIER_KEY[tier] : null);
	const accuracy = $derived(result?.accuracyCop ?? calibration?.accuracyCop ?? null);

	// A low-confidence estimate must never look like a confident one: the card
	// itself changes colour, gains a red rule, and is topped by a warning bar.
	const cardClass = $derived(
		level === 'low'
			? 'bg-red-50 border-4 border-red-500 text-red-950'
			: level === 'medium'
				? 'bg-amber-50 border-4 border-amber-400 text-amber-950'
				: 'bg-gray-900 border-4 border-gray-900 text-white'
	);
	const mutedClass = $derived(
		level === 'low' ? 'text-red-800' : level === 'medium' ? 'text-amber-800' : 'text-gray-300'
	);
	const dividerClass = $derived(
		level === 'low' ? 'border-red-300' : level === 'medium' ? 'border-amber-300' : 'border-gray-700'
	);
	const badgeClass = $derived(
		level === 'low'
			? 'bg-red-600 text-white'
			: level === 'medium'
				? 'bg-amber-500 text-amber-950'
				: level === 'good'
					? 'bg-sky-200 text-sky-900'
					: 'bg-emerald-200 text-emerald-900'
	);

	// text-gray-900 is explicit on purpose: the Skeleton base sets a light body
	// text colour in dark mode, which inputs would inherit over their white bg.
	const inputClass =
		'w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent';
</script>

<main class="min-h-dvh bg-gray-50 p-4 md:p-8">
	<div class="max-w-5xl mx-auto">
		<!-- Header -->
		<header class="bg-white border border-gray-200 rounded-xl p-4 sm:p-6 mb-6">
			<div class="flex flex-col gap-4">
				<div>
					<h1 class="text-2xl sm:text-3xl font-bold text-gray-900">
						{$_('admin.deliveryCalculator.title')}
					</h1>
					<p class="text-sm text-gray-500 mt-1">
						{$_('admin.deliveryCalculator.originNote', {
							values: { address: KITCHEN_ADDRESS }
						})}
					</p>
				</div>
				<div>
					<a
						href={resolve('/admin')}
						class="inline-block px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
					>
						{$_('admin.hub.backToHub')}
					</a>
				</div>
			</div>
		</header>

		<!-- One-time migration of corrections stranded in this browser -->
		{#if legacyCount > 0}
			<section class="bg-amber-50 border border-amber-300 rounded-xl p-4 mb-6">
				<p class="text-sm font-semibold text-amber-900">
					{$_('admin.deliveryCalculator.migration.heading', { values: { count: legacyCount } })}
				</p>
				<p class="text-sm text-amber-800 mt-1">
					{$_('admin.deliveryCalculator.migration.body')}
				</p>
				<button
					class="mt-3 px-4 py-2 bg-amber-600 text-white rounded-xl text-sm font-semibold hover:bg-amber-700 transition-colors disabled:opacity-50"
					onclick={runMigration}
					disabled={migrating}
				>
					{migrating
						? $_('admin.deliveryCalculator.migration.running')
						: $_('admin.deliveryCalculator.migration.run')}
				</button>
			</section>
		{/if}
		{#if migrationMessage}
			<p class="text-sm text-gray-700 mb-6">{migrationMessage}</p>
		{/if}

		<div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
			<!-- Address input + estimate -->
			<section class="bg-white border border-gray-200 rounded-xl p-4 sm:p-6 flex flex-col gap-5">
				<div>
					<h2 class="text-lg font-semibold text-gray-900">
						{$_('admin.deliveryCalculator.form.title')}
					</h2>
					<p class="text-sm text-gray-500 mt-1">
						{$_('admin.deliveryCalculator.form.hint')}
					</p>
				</div>

				<form class="flex flex-col gap-3" onsubmit={handleSubmit}>
					<div>
						<label for="address" class="block text-sm font-medium text-gray-700 mb-1">
							{$_('admin.deliveryCalculator.form.label')}
						</label>
						<input
							id="address"
							class={inputClass}
							placeholder={$_('admin.deliveryCalculator.form.placeholder')}
							autocomplete="off"
							bind:value={addressInput}
						/>
					</div>
					<button
						type="submit"
						class="self-start px-4 py-2 bg-gray-900 text-white rounded-xl text-sm font-semibold hover:bg-gray-800 transition-colors disabled:opacity-50"
						disabled={estimating || !addressInput.trim()}
					>
						{estimating
							? $_('admin.deliveryCalculator.form.submitting')
							: $_('admin.deliveryCalculator.form.submit')}
					</button>
				</form>

				{#if estimateError}
					<p class="text-sm text-red-600">{estimateError}</p>
				{/if}

				{#if result}
					<div class={`rounded-xl overflow-hidden ${cardClass}`}>
						<!-- The unmissable part: a solid bar, not a subtle grey label. -->
						{#if level === 'low' || level === 'medium'}
							<p
								class={`px-5 py-3 text-sm font-bold uppercase tracking-wide ${
									level === 'low' ? 'bg-red-600 text-white' : 'bg-amber-400 text-amber-950'
								}`}
							>
								⚠ {$_(`admin.deliveryCalculator.warning.${level}`)}
							</p>
						{/if}

						<div class="p-5">
							<div class="flex flex-wrap items-center gap-2">
								<p class={`text-xs uppercase tracking-wide ${mutedClass}`}>
									{level === 'low'
										? $_('admin.deliveryCalculator.result.approxLabel')
										: $_('admin.deliveryCalculator.result.label')}
								</p>
								{#if tierKey}
									<span
										class={`px-2 py-0.5 rounded-full text-xs font-bold uppercase tracking-wide ${badgeClass}`}
									>
										{$_(`admin.deliveryCalculator.tier.${tierKey}.badge`)}
									</span>
								{/if}
							</div>

							{#if result.estimate}
								<p class="text-4xl font-bold mt-1">
									{level === 'low' ? '≈ ' : ''}{formatCOP(result.estimate.cost)}
								</p>
							{:else}
								<p class="text-lg font-semibold mt-1">
									{$_('admin.deliveryCalculator.result.noEstimate')}
								</p>
							{/if}

							<!-- Plain language about what was actually matched. -->
							{#if tierKey}
								<p class={`text-sm mt-2 ${level === 'high' ? mutedClass : 'font-medium'}`}>
									{$_(`admin.deliveryCalculator.tier.${tierKey}.note`)}
								</p>
							{/if}

							<div class={`mt-3 pt-3 border-t ${dividerClass} text-sm`}>
								{#if result.resolvedPlate}
									<p>
										<span class={mutedClass}>{$_('admin.deliveryCalculator.result.plate')}:</span>
										<span class="font-semibold">{result.resolvedPlate}</span>
										{#if result.cached}
											<span class={`text-xs ${mutedClass}`}
												>({$_('admin.deliveryCalculator.result.cached')})</span
											>
										{/if}
									</p>
								{:else}
									<p class="font-semibold">{$_('admin.deliveryCalculator.result.plateNone')}</p>
								{/if}
								<p class={`text-xs mt-1 ${mutedClass}`}>
									{$_('admin.deliveryCalculator.result.parsedAs', {
										values: { address: result.address }
									})}
								</p>
							</div>

							{#if result.estimate}
								<dl class={`grid grid-cols-3 gap-3 mt-3 pt-3 border-t ${dividerClass} text-sm`}>
									<div>
										<dt class={mutedClass}>{$_('admin.deliveryCalculator.result.northSouth')}</dt>
										<dd class="font-semibold">{result.estimate.northKm.toFixed(2)} km</dd>
									</div>
									<div>
										<dt class={mutedClass}>{$_('admin.deliveryCalculator.result.eastWest')}</dt>
										<dd class="font-semibold">{result.estimate.eastKm.toFixed(2)} km</dd>
									</div>
									<div>
										<dt class={mutedClass}>{$_('admin.deliveryCalculator.result.total')}</dt>
										<dd class="font-semibold">{result.estimate.totalKm.toFixed(2)} km</dd>
									</div>
								</dl>
							{/if}

							<div class={`mt-3 pt-3 border-t ${dividerClass} text-xs ${mutedClass}`}>
								{#if accuracy}
									<p>
										{$_('admin.deliveryCalculator.result.margin', {
											values: { amount: formatCOP(accuracy) }
										})}
									</p>
								{:else}
									<p>{$_('admin.deliveryCalculator.result.marginUnknown')}</p>
								{/if}
								{#if result.observationCount}
									<p class="mt-1">
										{$_('admin.deliveryCalculator.result.observations', {
											values: { count: result.observationCount }
										})}
									</p>
								{/if}
								{#if result.estimate?.minFareApplied && calibration}
									<p class="mt-1">
										{$_('admin.deliveryCalculator.result.minFare', {
											values: { amount: formatCOP(calibration.model.minFare) }
										})}
									</p>
								{/if}
							</div>
						</div>
					</div>

					<!-- A truncated search is a retry prompt, not a verdict on the address. -->
					{#if result.searchTruncated}
						<div class="bg-blue-50 border-2 border-blue-400 rounded-xl p-4">
							<p class="text-sm font-bold text-blue-900">
								{$_('admin.deliveryCalculator.truncated.heading')}
							</p>
							<p class="text-sm text-blue-800 mt-1">
								{$_('admin.deliveryCalculator.truncated.body')}
							</p>
							<button
								class="mt-3 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50"
								onclick={runEstimate}
								disabled={estimating}
							>
								{$_('admin.deliveryCalculator.truncated.retry')}
							</button>
						</div>
					{/if}
				{:else if !estimateError}
					<div
						class="border border-dashed border-gray-300 rounded-xl p-6 text-center text-sm text-gray-500"
					>
						{$_('admin.deliveryCalculator.result.empty')}
					</div>
				{/if}

				<!-- The friendly ask: what did the courier really charge? -->
				{#if result}
					<div class="bg-gray-50 border border-gray-200 rounded-xl p-4">
						<p class="text-sm font-medium text-gray-900">
							{$_('admin.deliveryCalculator.feedback.question')}
						</p>
						<p class="text-xs text-gray-500 mt-1">
							{$_('admin.deliveryCalculator.feedback.explainer')}
						</p>
						<div class="flex flex-wrap items-end gap-3 mt-3">
							<div class="flex-1 min-w-32">
								<label for="actual-cost" class="block text-xs font-medium text-gray-700 mb-1">
									{$_('admin.deliveryCalculator.feedback.inputLabel')}
								</label>
								<input
									id="actual-cost"
									class={inputClass}
									placeholder="3700"
									inputmode="numeric"
									bind:value={actualCost}
								/>
							</div>
							<button
								class="px-4 py-2 bg-gray-900 text-white rounded-xl text-sm font-semibold hover:bg-gray-800 transition-colors disabled:opacity-50"
								onclick={saveActualCost}
								disabled={savingCost || !Number(actualCost)}
							>
								{savingCost
									? $_('admin.deliveryCalculator.feedback.saving')
									: $_('admin.deliveryCalculator.feedback.save')}
							</button>
						</div>
						{#if feedbackMessage}
							<p class="text-sm text-green-700 mt-3">{feedbackMessage}</p>
						{/if}
						{#if feedbackError}
							<p class="text-sm text-red-600 mt-3">{feedbackError}</p>
						{/if}
					</div>
				{/if}
			</section>

			<!-- Calibration panel: the shared, server-side training set -->
			<section class="bg-white border border-gray-200 rounded-xl p-4 sm:p-6 flex flex-col gap-5">
				<div class="flex items-start justify-between gap-3">
					<div>
						<h2 class="text-lg font-semibold text-gray-900">
							{$_('admin.deliveryCalculator.calibration.title')}
						</h2>
						<p class="text-sm text-gray-500 mt-1">
							{$_('admin.deliveryCalculator.calibration.summary', {
								values: { count: calibration?.count ?? 0 }
							})}
						</p>
						<p class="text-sm text-gray-500">
							{calibration?.accuracyCop
								? $_('admin.deliveryCalculator.calibration.accuracy', {
										values: { amount: formatCOP(calibration.accuracyCop) }
									})
								: $_('admin.deliveryCalculator.calibration.accuracyUnknown')}
						</p>
					</div>
					<button
						class="px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
						onclick={loadCalibration}
					>
						{$_('admin.deliveryCalculator.calibration.refresh')}
					</button>
				</div>

				{#if calibrationError}
					<p class="text-sm text-red-600">{calibrationError}</p>
				{/if}

				{#if calibration}
					<dl class="grid grid-cols-2 gap-3 text-sm">
						<div class="bg-gray-50 rounded-xl p-3">
							<dt class="text-gray-500">{$_('admin.deliveryCalculator.calibration.baseFare')}</dt>
							<dd class="font-semibold text-gray-900">
								{formatCOP(Math.round(calibration.model.intercept))}
							</dd>
						</div>
						<div class="bg-gray-50 rounded-xl p-3">
							<dt class="text-gray-500">{$_('admin.deliveryCalculator.calibration.minFare')}</dt>
							<dd class="font-semibold text-gray-900">{formatCOP(calibration.model.minFare)}</dd>
						</div>
						<div class="bg-gray-50 rounded-xl p-3">
							<dt class="text-gray-500">{$_('admin.deliveryCalculator.calibration.rateNS')}</dt>
							<dd class="font-semibold text-gray-900">
								{formatCOP(Math.round(calibration.model.ratePerKmNS))}/km
							</dd>
						</div>
						<div class="bg-gray-50 rounded-xl p-3">
							<dt class="text-gray-500">{$_('admin.deliveryCalculator.calibration.rateEW')}</dt>
							<dd class="font-semibold text-gray-900">
								{formatCOP(Math.round(calibration.model.ratePerKmEW))}/km
							</dd>
						</div>
					</dl>

					{#if calibration.observations.length}
						<ul class="flex flex-col gap-2 max-h-96 overflow-y-auto">
							{#each calibration.observations as observation (observation.id)}
								<li
									class="flex items-center justify-between gap-3 border border-gray-200 rounded-xl px-3 py-2"
								>
									<div class="min-w-0">
										<p class="text-sm text-gray-900 truncate">{observation.rawAddress}</p>
										<p class="text-xs text-gray-500">
											{formatCOP(observation.actualCost)}
											·
											{$_(
												`admin.deliveryCalculator.tier.${
													TIER_KEY[observation.matchTier as DeliveryMatchTier] ?? 'failed'
												}.badge`
											)}
										</p>
									</div>
									<button
										class="text-xs text-gray-500 hover:text-red-600 transition-colors"
										onclick={() => handleRemove(observation.id)}
									>
										{$_('admin.deliveryCalculator.calibration.remove')}
									</button>
								</li>
							{/each}
						</ul>
					{:else}
						<p class="text-sm text-gray-500">
							{$_('admin.deliveryCalculator.calibration.empty')}
						</p>
					{/if}
				{/if}

				<p class="text-xs text-gray-400 border-t border-gray-100 pt-4">
					{$_('admin.deliveryCalculator.calibration.storageNote')}
				</p>
			</section>
		</div>
	</div>
</main>
