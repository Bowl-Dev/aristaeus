<script lang="ts">
	import { listOrders, updateOrderStatus, ApiError, type AdminOrder } from '$lib/api/client';
	import { resolve } from '$app/paths';

	let orders = $state<AdminOrder[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let updatingOrderId = $state<number | null>(null);

	async function loadOrders() {
		loading = true;
		error = null;
		try {
			orders = await listOrders();
		} catch (e) {
			error = e instanceof ApiError ? e.message : 'Failed to load orders';
			console.error('Failed to fetch orders:', e);
		} finally {
			loading = false;
		}
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

	$effect(() => {
		loadOrders();
	});

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
		pending: 'bg-surface-500 text-white',
		queued: 'bg-secondary-500 text-white',
		assigned: 'bg-warning-500 text-black',
		preparing: 'bg-tertiary-500 text-white',
		ready: 'bg-success-500 text-white',
		completed: 'bg-primary-500 text-white',
		cancelled: 'bg-surface-500 text-white',
		failed: 'bg-error-500 text-white'
	};

	function formatDate(dateString: string): string {
		const date = new Date(dateString);
		return date.toLocaleString();
	}
</script>

<main class="p-4 md:p-8 max-w-7xl mx-auto">
	<div class="card bg-warning-500/20 border-2 border-warning-500 rounded-xl p-6 mb-8">
		<h1 class="text-3xl font-bold mb-2">Admin - Order Management</h1>
		<p class="text-warning-700 dark:text-warning-300 font-semibold mb-4">
			Testing Only - Not Part of Official Application
		</p>
		<div class="flex items-center gap-4">
			<a
				href={resolve('/')}
				class="btn bg-transparent border border-primary-500 text-primary-500 hover:bg-primary-500 hover:text-white px-4 py-2 rounded-lg font-semibold"
				>Back to Bowl Builder</a
			>
			<button
				class="btn bg-secondary-500 hover:bg-secondary-600 text-white px-4 py-2 rounded-lg font-semibold"
				onclick={loadOrders}
				disabled={loading}
			>
				{loading ? 'Loading...' : 'Refresh'}
			</button>
		</div>
	</div>

	{#if error}
		<div class="card bg-error-500 text-white rounded-xl p-4 mb-6 flex items-center justify-between">
			<p>{error}</p>
			<button
				class="btn bg-white text-error-700 px-4 py-2 rounded-lg font-semibold"
				onclick={loadOrders}>Try Again</button
			>
		</div>
	{/if}

	<div class="card bg-surface-100 dark:bg-surface-800 rounded-xl p-6">
		{#if loading && orders.length === 0}
			<div class="text-center py-12 text-surface-500">
				<p>Loading orders...</p>
			</div>
		{:else if orders.length === 0}
			<div class="text-center py-12 text-surface-500 text-xl">
				<p>No orders yet</p>
			</div>
		{:else}
			<div class="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
				{#each orders as order (order.id)}
					<div
						class="card bg-surface-200 dark:bg-surface-700 border border-surface-300 dark:border-surface-600 rounded-xl p-6 transition-all hover:ring-2 hover:ring-primary-500 {updatingOrderId ===
						order.id
							? 'opacity-60 pointer-events-none'
							: ''}"
					>
						<div class="mb-4 pb-4 border-b border-surface-300 dark:border-surface-600">
							<div class="flex items-center gap-3 mb-2">
								<span class="text-xl font-bold">Order #{order.id}</span>
								<span
									class="badge {statusColors[order.status] ||
										'bg-surface-500 text-white'} text-xs uppercase px-2 py-1 rounded"
								>
									{order.status}
								</span>
							</div>
							<div class="flex items-center gap-2 text-sm text-surface-500">
								<span class="font-semibold">Bowl: {order.bowlSize}g</span>
							</div>

							<!-- Customer Contact Info -->
							<div class="mt-3 p-3 bg-surface-100 dark:bg-surface-800 rounded-lg text-sm space-y-1">
								<div class="font-semibold text-surface-700 dark:text-surface-300">
									{order.user.name}
								</div>
								<div class="text-surface-500">
									<div class="flex items-center gap-1">
										<span>📞</span>
										<span>{order.user.phone}</span>
									</div>
									{#if order.user.email}
										<div class="flex items-center gap-1">
											<span>📧</span>
											<span>{order.user.email}</span>
										</div>
									{/if}
									<div class="flex items-start gap-1 mt-1">
										<span>📍</span>
										<span>
											{order.user.address.streetAddress}, {order.user.address.neighborhood}<br />
											{order.user.address.city}, {order.user.address.department}
											{#if order.user.address.postalCode}
												- {order.user.address.postalCode}
											{/if}
										</span>
									</div>
								</div>
							</div>
						</div>

						<div class="mb-4">
							<h3 class="font-semibold mb-2">Ingredients</h3>
							<div class="flex flex-col gap-1">
								{#each order.items.toSorted((a, b) => a.sequenceOrder - b.sequenceOrder) as item (item.sequenceOrder)}
									<div
										class="flex items-center gap-2 p-2 bg-surface-100 dark:bg-surface-800 rounded"
									>
										<span class="font-bold text-primary-500 w-6">{item.sequenceOrder}.</span>
										<span class="flex-1 font-semibold">{item.ingredientName}</span>
										<span class="text-surface-500 font-semibold">{item.quantityGrams}g</span>
									</div>
								{/each}
							</div>
						</div>

						<div
							class="card bg-surface-100 dark:bg-surface-800 border border-surface-300 dark:border-surface-600 rounded-lg p-4 mb-4"
						>
							<div class="flex justify-between py-1">
								<span class="text-surface-500 text-sm">Total Weight:</span>
								<span class="font-semibold">{order.totalWeightG}g / {order.bowlSize}g</span>
							</div>
							<div class="flex justify-between py-1">
								<span class="text-surface-500 text-sm">Calories:</span>
								<span class="font-semibold">{Math.round(order.totalCalories)}</span>
							</div>
							<div class="flex justify-between py-1">
								<span class="text-surface-500 text-sm">Created:</span>
								<span class="font-semibold">{formatDate(order.createdAt)}</span>
							</div>
							<div
								class="flex justify-between py-1 border-t border-surface-300 dark:border-surface-600 mt-2 pt-2"
							>
								<span class="text-surface-500 text-sm">Price:</span>
								<span class="font-bold text-primary-500">{order.totalPrice}$COP</span>
							</div>
						</div>

						<div class="flex flex-col gap-2">
							<label class="text-sm text-surface-500 font-semibold" for="status-{order.id}"
								>Change Status:</label
							>
							<select
								id="status-{order.id}"
								class="select bg-surface-50 dark:bg-surface-800 border-surface-300 dark:border-surface-600 rounded-lg p-2"
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
		{/if}
	</div>
</main>
