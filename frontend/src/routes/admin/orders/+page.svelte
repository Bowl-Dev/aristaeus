<script lang="ts">
	import {
		listOrders,
		updateOrderStatus,
		ApiError,
		type AdminOrder,
		type AdminOrderItem
	} from '$lib/api/client';
	import { resolve } from '$app/paths';

	// State
	let orders = $state<AdminOrder[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let updatingOrderId = $state<number | null>(null);

	// Pagination state
	let currentPage = $state(1);
	let itemsPerPage = $state(20);
	let totalOrders = $state(0);

	// Filter state
	let statusFilter = $state<string>('pending');

	// Derived pagination values
	const totalPages = $derived(Math.ceil(totalOrders / itemsPerPage));
	const offset = $derived((currentPage - 1) * itemsPerPage);

	// Category order for ingredient grouping (matches bowl builder)
	const categoryOrder = ['base', 'protein', 'vegetable', 'topping', 'dressing'];

	const categoryLabels: Record<string, string> = {
		base: 'Base',
		protein: 'Protein',
		vegetable: 'Vegetables',
		topping: 'Toppings',
		dressing: 'Dressing'
	};

	const availableStatuses = [
		'pending',
		'queued',
		'assigned',
		'preparing',
		'ready',
		'completed',
		'cancelled',
		'failed'
	];

	const statusColors: Record<string, string> = {
		pending: 'bg-gray-500 text-white',
		queued: 'bg-blue-500 text-white',
		assigned: 'bg-yellow-500 text-black',
		preparing: 'bg-teal-500 text-white',
		ready: 'bg-green-500 text-white',
		completed: 'bg-emerald-600 text-white',
		cancelled: 'bg-gray-400 text-white',
		failed: 'bg-red-500 text-white'
	};

	async function loadOrders() {
		loading = true;
		error = null;
		try {
			const response = await listOrders({
				status: statusFilter === 'all' ? undefined : statusFilter,
				limit: itemsPerPage,
				offset: offset
			});
			orders = response.orders;
			totalOrders = response.total;
		} catch (e) {
			error = e instanceof ApiError ? e.message : 'Failed to load orders';
			console.error('Failed to fetch orders:', e);
		} finally {
			loading = false;
		}
	}

	// Watch for filter/pagination changes
	$effect(() => {
		// Dependencies - accessing these triggers the effect when they change
		const _status = statusFilter;
		const _limit = itemsPerPage;
		const _page = currentPage;
		void _status;
		void _limit;
		void _page;
		loadOrders();
	});

	function handleFilterChange(newStatus: string) {
		statusFilter = newStatus;
		currentPage = 1;
	}

	function handleItemsPerPageChange(newLimit: number) {
		itemsPerPage = newLimit;
		currentPage = 1;
	}

	async function handleStatusUpdate(orderId: number, newStatus: string) {
		updatingOrderId = orderId;
		try {
			await updateOrderStatus(orderId, newStatus);
			await loadOrders();
		} catch (e) {
			const message = e instanceof ApiError ? e.message : 'Failed to update status';
			alert(`Error: ${message}`);
			console.error('Status update failed:', e);
		} finally {
			updatingOrderId = null;
		}
	}

	// Group items by category
	function groupItemsByCategory(items: AdminOrderItem[]): Record<string, AdminOrderItem[]> {
		const grouped: Record<string, AdminOrderItem[]> = {};
		for (const item of items) {
			const cat = item.ingredientCategory;
			if (!grouped[cat]) grouped[cat] = [];
			grouped[cat].push(item);
		}
		return grouped;
	}

	function formatDate(dateString: string): string {
		const date = new Date(dateString);
		return date.toLocaleString();
	}

	// Generate page numbers for pagination
	function getPageNumbers(): number[] {
		const pages: number[] = [];
		const maxVisible = 5;

		if (totalPages <= maxVisible) {
			for (let i = 1; i <= totalPages; i++) {
				pages.push(i);
			}
		} else {
			// Show first, last, and pages around current
			const start = Math.max(1, currentPage - 1);
			const end = Math.min(totalPages, currentPage + 1);

			if (start > 1) pages.push(1);
			if (start > 2) pages.push(-1); // Ellipsis marker

			for (let i = start; i <= end; i++) {
				pages.push(i);
			}

			if (end < totalPages - 1) pages.push(-1); // Ellipsis marker
			if (end < totalPages) pages.push(totalPages);
		}

		return pages;
	}
</script>

<main class="min-h-screen bg-gray-50 p-4 md:p-8">
	<div class="max-w-7xl mx-auto">
		<!-- Header -->
		<header class="bg-white border border-gray-200 rounded-xl p-4 sm:p-6 mb-6">
			<div class="flex flex-col gap-4">
				<div>
					<h1 class="text-2xl sm:text-3xl font-bold text-gray-900">Order Management</h1>
					<p class="text-sm text-gray-500 mt-1">Admin Dashboard</p>
				</div>
				<div class="flex flex-wrap items-center gap-3">
					<a
						href={resolve('/')}
						class="px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
					>
						Back to Bowl Builder
					</a>
					<button
						class="px-4 py-2 bg-gray-900 text-white rounded-xl text-sm font-semibold hover:bg-gray-800 transition-colors disabled:opacity-50"
						onclick={() => loadOrders()}
						disabled={loading}
					>
						{loading ? 'Loading...' : 'Refresh'}
					</button>
				</div>
			</div>
		</header>

		<!-- Filters & Pagination Controls -->
		<div class="bg-white border border-gray-200 rounded-xl p-4 mb-6">
			<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
				<!-- Status Filter -->
				<div class="flex items-center gap-3">
					<label for="status-filter" class="text-sm font-medium text-gray-700">Status:</label>
					<select
						id="status-filter"
						class="px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
						value={statusFilter}
						onchange={(e) => handleFilterChange(e.currentTarget.value)}
					>
						<option value="all">All</option>
						{#each availableStatuses as status (status)}
							<option value={status}>{status}</option>
						{/each}
					</select>
				</div>

				<!-- Items Per Page -->
				<div class="flex items-center gap-3">
					<label for="items-per-page" class="text-sm font-medium text-gray-700">Show:</label>
					<select
						id="items-per-page"
						class="px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
						value={itemsPerPage}
						onchange={(e) => handleItemsPerPageChange(parseInt(e.currentTarget.value))}
					>
						<option value={10}>10</option>
						<option value={20}>20</option>
						<option value={50}>50</option>
					</select>
					<span class="text-sm text-gray-500">of {totalOrders} orders</span>
				</div>
			</div>
		</div>

		<!-- Error State -->
		{#if error}
			<div
				class="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
			>
				<p class="text-red-600 text-sm">{error}</p>
				<button
					class="px-4 py-2 bg-red-600 text-white rounded-xl text-sm font-medium hover:bg-red-700 whitespace-nowrap"
					onclick={() => loadOrders()}
				>
					Try Again
				</button>
			</div>
		{/if}

		<!-- Orders Grid -->
		{#if loading && orders.length === 0}
			<div class="bg-white border border-gray-200 rounded-xl p-12 text-center">
				<div
					class="w-8 h-8 border-2 border-gray-900 border-t-transparent rounded-full animate-spin mx-auto"
				></div>
				<p class="text-gray-500 mt-4 text-sm">Loading orders...</p>
			</div>
		{:else if orders.length === 0}
			<div class="bg-white border border-gray-200 rounded-xl p-12 text-center">
				<p class="text-gray-500 text-lg">No orders found</p>
				<p class="text-gray-400 text-sm mt-1">Try adjusting your filters</p>
			</div>
		{:else}
			<div class="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
				{#each orders as order (order.id)}
					{@const groupedItems = groupItemsByCategory(order.items)}
					<div
						class="bg-white border border-gray-200 rounded-xl overflow-hidden transition-all hover:shadow-md {updatingOrderId ===
						order.id
							? 'opacity-60 pointer-events-none'
							: ''}"
					>
						<!-- Order Header -->
						<div class="p-4 sm:p-5 border-b border-gray-100">
							<div class="flex items-center justify-between mb-3">
								<span class="text-lg font-bold text-gray-900">Order #{order.id}</span>
								<span
									class="px-2.5 py-1 {statusColors[order.status] ||
										'bg-gray-500 text-white'} text-xs font-semibold uppercase rounded-full"
								>
									{order.status}
								</span>
							</div>
							<div class="flex flex-wrap items-center gap-2 text-sm text-gray-500">
								<span class="font-medium">{order.bowlSize}g bowl</span>
								{#if order.includeCutlery}
									<span class="text-gray-300">|</span>
									<span class="inline-flex items-center gap-1 text-gray-600">
										<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path
												stroke-linecap="round"
												stroke-linejoin="round"
												stroke-width="2"
												d="M12 6v6m0 0v6m0-6h6m-6 0H6"
											/>
										</svg>
										Cutlery
									</span>
								{/if}
							</div>
						</div>

						<!-- Customer Info -->
						<div class="p-4 sm:p-5 border-b border-gray-100 bg-gray-50">
							<div class="text-sm">
								<p class="font-semibold text-gray-900">{order.user.name}</p>
								<p class="text-gray-500 mt-1">{order.user.phone}</p>
								{#if order.user.email}
									<p class="text-gray-500">{order.user.email}</p>
								{/if}
								<p class="text-gray-500 mt-2 text-xs">
									{order.user.address.streetAddress}, {order.user.address.neighborhood}<br />
									{order.user.address.city}, {order.user.address.department}
									{#if order.user.address.postalCode}
										- {order.user.address.postalCode}
									{/if}
								</p>
							</div>
						</div>

						<!-- Ingredients by Category -->
						<div class="p-4 sm:p-5 border-b border-gray-100">
							<h4 class="text-sm font-semibold text-gray-900 mb-3">Ingredients</h4>
							<div class="space-y-3">
								{#each categoryOrder as category (category)}
									{#if groupedItems[category]?.length > 0}
										<div>
											<p class="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">
												{categoryLabels[category] || category}
											</p>
											<div class="space-y-1">
												{#each groupedItems[category] as item (item.ingredientName)}
													<div
														class="flex items-center justify-between py-1.5 px-2 bg-gray-50 rounded"
													>
														<span class="text-sm text-gray-900">{item.ingredientName}</span>
														<span class="text-sm text-gray-500 font-medium"
															>{item.quantityGrams}g</span
														>
													</div>
												{/each}
											</div>
										</div>
									{/if}
								{/each}
							</div>
						</div>

						<!-- Order Summary -->
						<div class="p-4 sm:p-5 border-b border-gray-100 bg-gray-50">
							<div class="grid grid-cols-2 gap-2 text-sm">
								<div class="flex justify-between">
									<span class="text-gray-500">Weight:</span>
									<span class="font-medium">{order.totalWeightG}g</span>
								</div>
								<div class="flex justify-between">
									<span class="text-gray-500">Calories:</span>
									<span class="font-medium">{Math.round(order.totalCalories)}</span>
								</div>
								<div class="flex justify-between col-span-2">
									<span class="text-gray-500">Created:</span>
									<span class="font-medium text-xs">{formatDate(order.createdAt)}</span>
								</div>
								<div class="flex justify-between col-span-2 border-t border-gray-200 pt-2 mt-1">
									<span class="text-gray-500">Price:</span>
									<span class="font-bold text-gray-900">${order.totalPrice} COP</span>
								</div>
							</div>
						</div>

						<!-- Status Update -->
						<div class="p-4 sm:p-5">
							<label for="status-{order.id}" class="block text-sm font-medium text-gray-700 mb-2">
								Update Status
							</label>
							<select
								id="status-{order.id}"
								class="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
								value={order.status}
								disabled={updatingOrderId === order.id}
								onchange={(e) => handleStatusUpdate(order.id, e.currentTarget.value)}
							>
								{#each availableStatuses as status (status)}
									<option value={status}>{status}</option>
								{/each}
							</select>
						</div>
					</div>
				{/each}
			</div>

			<!-- Pagination Controls -->
			{#if totalPages > 1}
				<div class="bg-white border border-gray-200 rounded-xl p-4 mt-6">
					<div class="flex flex-col sm:flex-row items-center justify-between gap-4">
						<button
							class="w-full sm:w-auto px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
							disabled={currentPage === 1 || loading}
							onclick={() => (currentPage = currentPage - 1)}
						>
							Previous
						</button>

						<div class="flex items-center gap-1 sm:gap-2 flex-wrap justify-center">
							{#each getPageNumbers() as page, index (page === -1 ? `ellipsis-${index}` : page)}
								{#if page === -1}
									<span class="px-2 text-gray-400">...</span>
								{:else}
									<button
										class="w-9 h-9 sm:w-10 sm:h-10 rounded-xl text-sm font-medium transition-colors {page ===
										currentPage
											? 'bg-gray-900 text-white'
											: 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'}"
										disabled={loading}
										onclick={() => (currentPage = page)}
									>
										{page}
									</button>
								{/if}
							{/each}
						</div>

						<button
							class="w-full sm:w-auto px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
							disabled={currentPage === totalPages || loading}
							onclick={() => (currentPage = currentPage + 1)}
						>
							Next
						</button>
					</div>
				</div>
			{/if}
		{/if}
	</div>
</main>
