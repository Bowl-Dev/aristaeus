<script lang="ts">
	import { resolve } from '$app/paths';
	import { _ } from 'svelte-i18n';
	import { onMount } from 'svelte';
	import { formatCOP } from '$lib/utils/bowl';
	import {
		BASELINE_MODEL,
		KITCHEN_ORIGIN,
		estimateDelivery,
		formatAddress,
		isValidAddress,
		meanAbsoluteError,
		type BogotaAddress,
		type DeliveryObservation
	} from '$lib/utils/deliveryModel';
	import {
		addCorrection,
		calibrationSet,
		clearCorrections,
		currentModel,
		exportCorrections,
		importCorrections,
		loadCorrections,
		removeCorrection
	} from '$lib/utils/deliveryCalibration';

	// Address form
	let calle = $state('');
	let carrera = $state('');
	let numero = $state('');

	// Calibration state. Loaded on mount so SSR/prerender never touches storage.
	let corrections = $state<DeliveryObservation[]>([]);
	let actualCost = $state('');
	let feedbackMessage = $state<string | null>(null);
	let importError = $state<string | null>(null);
	let fileInput = $state<HTMLInputElement | null>(null);

	onMount(() => {
		corrections = loadCorrections();
	});

	const model = $derived(currentModel(corrections));
	const trainingSet = $derived(calibrationSet(corrections));
	const typicalError = $derived(meanAbsoluteError(model, trainingSet));

	const address = $derived<BogotaAddress | null>(
		isValidAddress({ calle, carrera, numero: Number(numero) })
			? { calle: calle.trim(), carrera: carrera.trim(), numero: Number(numero) }
			: null
	);

	const estimate = $derived(address ? estimateDelivery(address, model) : null);

	// How far the corrections have moved the estimate away from the Ops-only fit.
	const baselineEstimate = $derived(address ? estimateDelivery(address, BASELINE_MODEL) : null);
	const drift = $derived(estimate && baselineEstimate ? estimate.cost - baselineEstimate.cost : 0);

	// Any input change invalidates the "saved" confirmation from the last address.
	$effect(() => {
		void calle;
		void carrera;
		void numero;
		feedbackMessage = null;
	});

	function saveActualCost() {
		const value = Number(actualCost);
		if (!address || !Number.isFinite(value) || value <= 0) return;

		const before = estimate?.cost ?? 0;
		corrections = addCorrection(address, value);
		const after = estimateDelivery(address, currentModel(corrections))?.cost ?? before;

		feedbackMessage = $_('admin.deliveryCalculator.feedback.saved', {
			values: { before: formatCOP(before), after: formatCOP(after) }
		});
		actualCost = '';
	}

	function handleExport() {
		const blob = new Blob([exportCorrections(corrections)], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const link = document.createElement('a');
		link.href = url;
		link.download = `delivery-calibration-${new Date().toISOString().slice(0, 10)}.json`;
		link.click();
		URL.revokeObjectURL(url);
	}

	async function handleImport(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;

		importError = null;
		try {
			const result = importCorrections(await file.text());
			corrections = result.corrections;
			feedbackMessage = $_('admin.deliveryCalculator.calibration.imported', {
				values: { count: result.added }
			});
		} catch {
			importError = $_('admin.deliveryCalculator.calibration.importError');
		} finally {
			// Reset so re-picking the same file fires a change event again.
			input.value = '';
		}
	}

	function handleClear() {
		if (!confirm($_('admin.deliveryCalculator.calibration.clearConfirm'))) return;
		corrections = clearCorrections();
		feedbackMessage = null;
	}

	function handleRemove(index: number) {
		corrections = removeCorrection(index);
	}

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
							values: { address: formatAddress(KITCHEN_ORIGIN) }
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

				<div class="grid grid-cols-3 gap-3">
					<div>
						<label for="calle" class="block text-sm font-medium text-gray-700 mb-1">
							{$_('admin.deliveryCalculator.form.calle')}
						</label>
						<input
							id="calle"
							class={inputClass}
							placeholder="146"
							inputmode="text"
							bind:value={calle}
						/>
					</div>
					<div>
						<label for="carrera" class="block text-sm font-medium text-gray-700 mb-1">
							{$_('admin.deliveryCalculator.form.carrera')}
						</label>
						<input
							id="carrera"
							class={inputClass}
							placeholder="21"
							inputmode="text"
							bind:value={carrera}
						/>
					</div>
					<div>
						<label for="numero" class="block text-sm font-medium text-gray-700 mb-1">
							{$_('admin.deliveryCalculator.form.numero')}
						</label>
						<input
							id="numero"
							class={inputClass}
							placeholder="86"
							inputmode="numeric"
							bind:value={numero}
						/>
					</div>
				</div>

				{#if estimate}
					<div class="bg-gray-900 text-white rounded-xl p-5">
						<p class="text-xs uppercase tracking-wide text-gray-300">
							{$_('admin.deliveryCalculator.result.label')}
						</p>
						<p class="text-4xl font-bold mt-1">{formatCOP(estimate.cost)}</p>
						{#if typicalError}
							<p class="text-sm text-gray-300 mt-2">
								{$_('admin.deliveryCalculator.result.margin', {
									values: { amount: formatCOP(typicalError) }
								})}
							</p>
						{/if}
						<dl class="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-gray-700 text-sm">
							<div>
								<dt class="text-gray-400">{$_('admin.deliveryCalculator.result.northSouth')}</dt>
								<dd class="font-semibold">{estimate.northKm.toFixed(2)} km</dd>
							</div>
							<div>
								<dt class="text-gray-400">{$_('admin.deliveryCalculator.result.eastWest')}</dt>
								<dd class="font-semibold">{estimate.eastKm.toFixed(2)} km</dd>
							</div>
							<div>
								<dt class="text-gray-400">{$_('admin.deliveryCalculator.result.total')}</dt>
								<dd class="font-semibold">{estimate.totalKm.toFixed(2)} km</dd>
							</div>
						</dl>
						{#if estimate.minFareApplied}
							<p class="text-xs text-gray-300 mt-3">
								{$_('admin.deliveryCalculator.result.minFare', {
									values: { amount: formatCOP(model.minFare) }
								})}
							</p>
						{/if}
						{#if drift !== 0}
							<p class="text-xs text-gray-300 mt-1">
								{$_('admin.deliveryCalculator.result.drift', {
									values: {
										amount: formatCOP(Math.abs(drift)),
										direction: $_(
											drift > 0
												? 'admin.deliveryCalculator.result.higher'
												: 'admin.deliveryCalculator.result.lower'
										)
									}
								})}
							</p>
						{/if}
					</div>
				{:else}
					<div
						class="border border-dashed border-gray-300 rounded-xl p-6 text-center text-sm text-gray-500"
					>
						{$_('admin.deliveryCalculator.result.empty')}
					</div>
				{/if}

				<!-- The friendly ask: what did the courier really charge? -->
				{#if estimate}
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
								disabled={!Number(actualCost)}
							>
								{$_('admin.deliveryCalculator.feedback.save')}
							</button>
						</div>
						{#if feedbackMessage}
							<p class="text-sm text-green-700 mt-3">{feedbackMessage}</p>
						{/if}
					</div>
				{/if}
			</section>

			<!-- Calibration panel -->
			<section class="bg-white border border-gray-200 rounded-xl p-4 sm:p-6 flex flex-col gap-5">
				<div>
					<h2 class="text-lg font-semibold text-gray-900">
						{$_('admin.deliveryCalculator.calibration.title')}
					</h2>
					<p class="text-sm text-gray-500 mt-1">
						{$_('admin.deliveryCalculator.calibration.summary', {
							values: {
								seed: trainingSet.length - corrections.length,
								corrections: corrections.length
							}
						})}
					</p>
				</div>

				<dl class="grid grid-cols-2 gap-3 text-sm">
					<div class="bg-gray-50 rounded-xl p-3">
						<dt class="text-gray-500">{$_('admin.deliveryCalculator.calibration.baseFare')}</dt>
						<dd class="font-semibold text-gray-900">{formatCOP(Math.round(model.intercept))}</dd>
					</div>
					<div class="bg-gray-50 rounded-xl p-3">
						<dt class="text-gray-500">{$_('admin.deliveryCalculator.calibration.minFare')}</dt>
						<dd class="font-semibold text-gray-900">{formatCOP(model.minFare)}</dd>
					</div>
					<div class="bg-gray-50 rounded-xl p-3">
						<dt class="text-gray-500">{$_('admin.deliveryCalculator.calibration.rateNS')}</dt>
						<dd class="font-semibold text-gray-900">
							{formatCOP(Math.round(model.ratePerKmNS))}/km
						</dd>
					</div>
					<div class="bg-gray-50 rounded-xl p-3">
						<dt class="text-gray-500">{$_('admin.deliveryCalculator.calibration.rateEW')}</dt>
						<dd class="font-semibold text-gray-900">
							{formatCOP(Math.round(model.ratePerKmEW))}/km
						</dd>
					</div>
				</dl>

				{#if corrections.length}
					<ul class="flex flex-col gap-2 max-h-64 overflow-y-auto">
						{#each corrections as correction, index (correction.recordedAt ?? index)}
							<li
								class="flex items-center justify-between gap-3 border border-gray-200 rounded-xl px-3 py-2"
							>
								<div class="min-w-0">
									<p class="text-sm text-gray-900 truncate">{formatAddress(correction)}</p>
									<p class="text-xs text-gray-500">{formatCOP(correction.actualCost)}</p>
								</div>
								<button
									class="text-xs text-gray-500 hover:text-red-600 transition-colors"
									onclick={() => handleRemove(index)}
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

				<div class="flex flex-wrap gap-3">
					<button
						class="px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
						onclick={handleExport}
						disabled={!corrections.length}
					>
						{$_('admin.deliveryCalculator.calibration.export')}
					</button>
					<button
						class="px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
						onclick={() => fileInput?.click()}
					>
						{$_('admin.deliveryCalculator.calibration.import')}
					</button>
					<button
						class="px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
						onclick={handleClear}
						disabled={!corrections.length}
					>
						{$_('admin.deliveryCalculator.calibration.clear')}
					</button>
					<input
						bind:this={fileInput}
						type="file"
						accept="application/json"
						class="hidden"
						onchange={handleImport}
					/>
				</div>
				{#if importError}
					<p class="text-sm text-red-600">{importError}</p>
				{/if}

				<p class="text-xs text-gray-400 border-t border-gray-100 pt-4">
					{$_('admin.deliveryCalculator.calibration.storageNote')}
				</p>
			</section>
		</div>
	</div>
</main>
