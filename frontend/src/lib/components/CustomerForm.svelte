<script lang="ts">
	import { _ } from 'svelte-i18n';

	// Props - all bindable for two-way binding with parent
	let {
		customerName = $bindable(),
		customerPhone = $bindable(),
		customerEmail = $bindable(),
		streetAddress = $bindable(),
		neighborhood = $bindable(),
		city = $bindable(),
		department = $bindable(),
		postalCode = $bindable()
	}: {
		customerName: string;
		customerPhone: string;
		customerEmail: string;
		streetAddress: string;
		neighborhood: string;
		city: string;
		department: string;
		postalCode: string;
	} = $props();

	// Local validation derived states (for inline error display)
	const isValidColombianPhone = $derived(
		/^(\+57)?[0-9]{10}$/.test(customerPhone.replace(/\s/g, ''))
	);

	const isValidEmail = $derived(
		customerEmail.length === 0 || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)
	);

	const isValidPostalCode = $derived(postalCode.length === 0 || /^[0-9]{6}$/.test(postalCode));
</script>

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
			placeholder={$_('home.customerName.placeholder')}
			class="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-shadow"
		/>
	</div>

	<!-- Phone -->
	<div>
		<label for="customer-phone" class="block text-sm font-medium text-gray-700 mb-2"
			>{$_('home.customerPhone.label')}</label
		>
		<input
			id="customer-phone"
			type="tel"
			bind:value={customerPhone}
			placeholder={$_('home.customerPhone.placeholder')}
			class="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-shadow {customerPhone &&
			!isValidColombianPhone
				? 'border-red-300 focus:ring-red-500'
				: ''}"
		/>
		{#if customerPhone && !isValidColombianPhone}
			<p class="text-xs text-red-600 mt-1">{$_('home.customerPhone.invalid')}</p>
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
