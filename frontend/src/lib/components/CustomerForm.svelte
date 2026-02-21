<script lang="ts">
	import { _ } from 'svelte-i18n';
	import { checkPhone, type CheckPhoneResponse } from '$lib/api/client';

	// Props - all bindable for two-way binding with parent
	let {
		customerName = $bindable(),
		customerPhone = $bindable(),
		customerEmail = $bindable(),
		streetAddress = $bindable(),
		neighborhood = $bindable(),
		city = $bindable(),
		department = $bindable(),
		postalCode = $bindable(),
		updateUserData = $bindable()
	}: {
		customerName: string;
		customerPhone: string;
		customerEmail: string;
		streetAddress: string;
		neighborhood: string;
		city: string;
		department: string;
		postalCode: string;
		updateUserData: boolean;
	} = $props();

	// Returning customer state
	let checkingPhone = $state(false);
	let returningCustomer = $state<CheckPhoneResponse['user'] | null>(null);
	let showReturningCustomerModal = $state(false);
	let phoneCheckTimeout: ReturnType<typeof setTimeout> | null = null;
	let lastCheckedPhone = $state('');

	// Store original data when user chooses "Use This Info" to detect manual changes
	let originalData = $state<{
		name: string;
		email: string;
		streetAddress: string;
		neighborhood: string;
		city: string;
		department: string;
		postalCode: string;
	} | null>(null);

	// Local validation derived states (for inline error display)
	const isValidColombianPhone = $derived(
		/^(\+57)?[0-9]{10}$/.test(customerPhone.replace(/\s/g, ''))
	);

	const isValidEmail = $derived(
		customerEmail.length === 0 || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)
	);

	const isValidPostalCode = $derived(postalCode.length === 0 || /^[0-9]{6}$/.test(postalCode));

	// Debounced phone check
	function handlePhoneInput() {
		// Clear any pending check
		if (phoneCheckTimeout) {
			clearTimeout(phoneCheckTimeout);
			phoneCheckTimeout = null;
		}

		const normalizedPhone = customerPhone.replace(/\s/g, '');

		// Don't check if invalid or already checked this phone
		if (!isValidColombianPhone || normalizedPhone === lastCheckedPhone) {
			return;
		}

		// Reset returning customer if phone changed
		if (returningCustomer && normalizedPhone !== lastCheckedPhone) {
			returningCustomer = null;
			updateUserData = false;
		}

		// Debounce the phone check
		phoneCheckTimeout = setTimeout(async () => {
			checkingPhone = true;
			try {
				const response = await checkPhone(normalizedPhone);
				lastCheckedPhone = normalizedPhone;

				if (response.exists && response.user) {
					returningCustomer = response.user;
					showReturningCustomerModal = true;
				} else {
					returningCustomer = null;
				}
			} catch (e) {
				console.error('Phone check failed:', e);
				// Silently fail - user can still proceed
			} finally {
				checkingPhone = false;
			}
		}, 500);
	}

	// Use existing customer data
	function useExistingData() {
		if (returningCustomer) {
			customerName = returningCustomer.name;
			customerEmail = returningCustomer.email || '';
			streetAddress = returningCustomer.address.streetAddress;
			neighborhood = returningCustomer.address.neighborhood;
			city = returningCustomer.address.city;
			department = returningCustomer.address.department;
			postalCode = returningCustomer.address.postalCode || '';
			updateUserData = false; // Don't update backend

			// Store original data to detect manual changes later
			originalData = {
				name: customerName,
				email: customerEmail,
				streetAddress: streetAddress,
				neighborhood: neighborhood,
				city: city,
				department: department,
				postalCode: postalCode
			};
		}
		showReturningCustomerModal = false;
	}

	// Detect manual changes after using existing data
	function handleFieldChange() {
		// Only check if we have original data (user chose "Use This Info")
		if (originalData && !updateUserData) {
			const hasChanged =
				customerName !== originalData.name ||
				customerEmail !== originalData.email ||
				streetAddress !== originalData.streetAddress ||
				neighborhood !== originalData.neighborhood ||
				city !== originalData.city ||
				department !== originalData.department ||
				postalCode !== originalData.postalCode;

			if (hasChanged) {
				updateUserData = true; // User manually changed data, so update backend
			}
		}
	}

	// User wants to update their data
	function updateMyData() {
		updateUserData = true; // Will update backend with new form values
		showReturningCustomerModal = false;
	}

	// Close modal without action (user can fill form manually)
	function closeModal() {
		showReturningCustomerModal = false;
		updateUserData = true; // Assume they want to update if they dismiss
	}
</script>

<!-- Returning Customer Modal -->
{#if showReturningCustomerModal && returningCustomer}
	<div
		class="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
		role="dialog"
		aria-modal="true"
	>
		<div class="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
			<h3 class="text-lg font-bold text-gray-900 mb-2">
				{$_('customer.returning.title')}
			</h3>
			<p class="text-gray-500 text-sm mb-4">
				{$_('customer.returning.message')}
			</p>

			<div class="bg-gray-50 rounded-xl p-4 mb-6 text-sm">
				<p class="font-semibold text-gray-900">{returningCustomer.name}</p>
				{#if returningCustomer.email}
					<p class="text-gray-500">{returningCustomer.email}</p>
				{/if}
				<p class="text-gray-500 mt-2">
					{returningCustomer.address.streetAddress}<br />
					{returningCustomer.address.neighborhood}, {returningCustomer.address.city}
				</p>
			</div>

			<div class="flex gap-3">
				<button
					class="flex-1 py-3 bg-gray-900 text-white rounded-xl font-medium hover:bg-gray-800 transition-colors"
					onclick={useExistingData}
				>
					{$_('customer.returning.useThis')}
				</button>
				<button
					class="flex-1 py-3 bg-white border border-gray-200 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors"
					onclick={updateMyData}
				>
					{$_('customer.returning.updateMy')}
				</button>
			</div>

			<button
				class="w-full mt-3 py-2 text-gray-500 text-sm hover:text-gray-700 transition-colors"
				onclick={closeModal}
			>
				{$_('customer.returning.dismiss')}
			</button>
		</div>
	</div>
{/if}

<!-- Customer Information -->
<section class="mb-8 space-y-4">
	<h3 class="text-sm font-semibold text-gray-900 uppercase tracking-wide">
		{$_('home.customerInfo.title')}
	</h3>

	<!-- Name -->
	<div>
		<label for="customer-name" class="block text-sm font-medium text-gray-700 mb-2"
			>{$_('home.customerName.label')}</label
		>
		<input
			id="customer-name"
			type="text"
			bind:value={customerName}
			oninput={handleFieldChange}
			placeholder={$_('home.customerName.placeholder')}
			class="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-shadow"
		/>
	</div>

	<!-- Phone -->
	<div>
		<label for="customer-phone" class="block text-sm font-medium text-gray-700 mb-2">
			{$_('home.customerPhone.label')}
			{#if checkingPhone}
				<span class="text-gray-400 text-xs ml-2">Checking...</span>
			{/if}
		</label>
		<input
			id="customer-phone"
			type="tel"
			bind:value={customerPhone}
			oninput={handlePhoneInput}
			placeholder={$_('home.customerPhone.placeholder')}
			class="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-shadow {customerPhone &&
			!isValidColombianPhone
				? 'border-red-300 focus:ring-red-500'
				: ''}"
		/>
		{#if customerPhone && !isValidColombianPhone}
			<p class="text-xs text-red-600 mt-1">{$_('home.customerPhone.invalid')}</p>
		{/if}
		{#if returningCustomer && !showReturningCustomerModal}
			<p class="text-xs text-emerald-600 mt-1">
				{$_('customer.returning.recognized')}
			</p>
		{/if}
	</div>

	<!-- Email (optional) -->
	<div>
		<label for="customer-email" class="block text-sm font-medium text-gray-700 mb-2"
			>{$_('home.customerEmail.label')}</label
		>
		<input
			id="customer-email"
			type="email"
			bind:value={customerEmail}
			oninput={handleFieldChange}
			placeholder={$_('home.customerEmail.placeholder')}
			class="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-shadow {customerEmail &&
			!isValidEmail
				? 'border-red-300 focus:ring-red-500'
				: ''}"
		/>
		{#if customerEmail && !isValidEmail}
			<p class="text-xs text-red-600 mt-1">{$_('home.customerEmail.invalid')}</p>
		{/if}
	</div>
</section>

<!-- Delivery Address -->
<section class="mb-8 space-y-4">
	<h3 class="text-sm font-semibold text-gray-900 uppercase tracking-wide">
		{$_('home.address.title')}
	</h3>

	<!-- Street Address -->
	<div>
		<label for="street-address" class="block text-sm font-medium text-gray-700 mb-2"
			>{$_('home.address.streetAddress.label')}</label
		>
		<input
			id="street-address"
			type="text"
			bind:value={streetAddress}
			oninput={handleFieldChange}
			placeholder={$_('home.address.streetAddress.placeholder')}
			class="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-shadow"
		/>
	</div>

	<!-- Neighborhood -->
	<div>
		<label for="neighborhood" class="block text-sm font-medium text-gray-700 mb-2"
			>{$_('home.address.neighborhood.label')}</label
		>
		<input
			id="neighborhood"
			type="text"
			bind:value={neighborhood}
			oninput={handleFieldChange}
			placeholder={$_('home.address.neighborhood.placeholder')}
			class="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-shadow"
		/>
	</div>

	<!-- City & Department (side by side) -->
	<div class="grid grid-cols-2 gap-3">
		<div>
			<label for="city" class="block text-sm font-medium text-gray-700 mb-2"
				>{$_('home.address.city.label')}</label
			>
			<input
				id="city"
				type="text"
				bind:value={city}
				oninput={handleFieldChange}
				placeholder={$_('home.address.city.placeholder')}
				class="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-shadow"
			/>
		</div>
		<div>
			<label for="department" class="block text-sm font-medium text-gray-700 mb-2"
				>{$_('home.address.department.label')}</label
			>
			<input
				id="department"
				type="text"
				bind:value={department}
				oninput={handleFieldChange}
				placeholder={$_('home.address.department.placeholder')}
				class="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-shadow"
			/>
		</div>
	</div>

	<!-- Postal Code (optional) -->
	<div>
		<label for="postal-code" class="block text-sm font-medium text-gray-700 mb-2"
			>{$_('home.address.postalCode.label')}</label
		>
		<input
			id="postal-code"
			type="text"
			bind:value={postalCode}
			oninput={handleFieldChange}
			placeholder={$_('home.address.postalCode.placeholder')}
			maxlength="6"
			class="w-full max-w-[200px] px-4 py-3 bg-white border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-shadow {postalCode &&
			!isValidPostalCode
				? 'border-red-300 focus:ring-red-500'
				: ''}"
		/>
		{#if postalCode && !isValidPostalCode}
			<p class="text-xs text-red-600 mt-1">{$_('home.address.postalCode.invalid')}</p>
		{/if}
	</div>
</section>
