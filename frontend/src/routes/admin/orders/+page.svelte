<script lang="ts">
	// TEMPORARY ADMIN VIEW FOR TESTING ONLY
	// This route is not part of the official application spec
	// DO NOT DOCUMENT - for internal testing only

	import { listOrders, updateOrderStatus, ApiError, type AdminOrder } from '$lib/api/client';

	// State
	let orders = $state<AdminOrder[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let updatingOrderId = $state<number | null>(null);

	// Load orders on mount
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

	// Update order status
	async function handleStatusUpdate(orderId: number, newStatus: string) {
		updatingOrderId = orderId;
		try {
			await updateOrderStatus(orderId, newStatus);
			// Refresh orders list
			await loadOrders();
		} catch (e) {
			const message = e instanceof ApiError ? e.message : 'Failed to update status';
			alert(`Error: ${message}`);
			console.error('Status update failed:', e);
		} finally {
			updatingOrderId = null;
		}
	}

	// Load orders when component mounts
	$effect(() => {
		loadOrders();
	});

	// Available statuses for dropdown
	const availableStatuses = ['pending', 'queued', 'assigned', 'preparing', 'ready', 'completed', 'cancelled', 'failed'];

	// Status badge colors
	const statusColors: Record<string, string> = {
		pending: '#95a5a6',
		queued: '#3498db',
		assigned: '#f39c12',
		preparing: '#e67e22',
		ready: '#27ae60',
		completed: '#16a085',
		cancelled: '#7f8c8d',
		failed: '#e74c3c'
	};

	function formatDate(dateString: string): string {
		const date = new Date(dateString);
		return date.toLocaleString();
	}
</script>

<main>
	<div class="admin-header">
		<h1>Admin - Order Management</h1>
		<p class="admin-warning">Testing Only - Not Part of Official Application</p>
		<div class="header-actions">
			<a href="/" class="back-link">Back to Bowl Builder</a>
			<button class="refresh-btn" onclick={loadOrders} disabled={loading}>
				{loading ? 'Loading...' : 'Refresh'}
			</button>
		</div>
	</div>

	{#if error}
		<div class="error-banner">
			<p>{error}</p>
			<button onclick={loadOrders}>Try Again</button>
		</div>
	{/if}

	<div class="orders-container">
		{#if loading && orders.length === 0}
			<div class="loading-state">
				<p>Loading orders...</p>
			</div>
		{:else if orders.length === 0}
			<div class="empty-state">
				<p>No orders yet</p>
			</div>
		{:else}
			<div class="orders-grid">
				{#each orders as order}
					<div class="order-card" class:updating={updatingOrderId === order.id}>
						<div class="order-header">
							<div class="order-id-section">
								<span class="order-id">Order #{order.id}</span>
								<span
									class="status-badge"
									style="background-color: {statusColors[order.status] || '#95a5a6'}"
								>
									{order.status}
								</span>
							</div>
							<div class="bowl-info">
								<span class="bowl-size-label">Bowl: {order.bowlSize}g</span>
								{#if order.customerName}
									<span class="customer-name">{order.customerName}</span>
								{/if}
							</div>
						</div>

						<div class="order-details">
							<h3>Ingredients</h3>
							<div class="ingredients-list">
								{#each order.items.toSorted((a, b) => a.sequenceOrder - b.sequenceOrder) as item}
									<div class="ingredient-row">
										<span class="seq-number">{item.sequenceOrder}.</span>
										<span class="ingredient-name">{item.ingredientName}</span>
										<span class="ingredient-qty">{item.quantityGrams}g</span>
									</div>
								{/each}
							</div>
						</div>

						<div class="order-summary">
							<div class="summary-item">
								<span class="label">Total Weight:</span>
								<span class="value">{order.totalWeightG}g / {order.bowlSize}g</span>
							</div>
							<div class="summary-item">
								<span class="label">Calories:</span>
								<span class="value">{Math.round(order.totalCalories)}</span>
							</div>
							<div class="summary-item">
								<span class="label">Created:</span>
								<span class="value">{formatDate(order.createdAt)}</span>
							</div>
						</div>

						<div class="order-actions">
							<label class="status-label" for="status-{order.id}">Change Status:</label>
							<select
								id="status-{order.id}"
								class="status-select"
								value={order.status}
								disabled={updatingOrderId === order.id}
								onchange={(e) => handleStatusUpdate(order.id, e.currentTarget.value)}
							>
								{#each availableStatuses as status}
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

<style>
	main {
		padding: 2rem;
		max-width: 1400px;
		margin: 0 auto;
		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
	}

	.admin-header {
		margin-bottom: 2rem;
		padding: 1.5rem;
		background: #fff3cd;
		border: 2px solid #ffc107;
		border-radius: 8px;
	}

	.admin-header h1 {
		color: #2c3e50;
		font-size: 2rem;
		margin: 0 0 0.5rem 0;
	}

	.admin-warning {
		color: #856404;
		margin: 0 0 1rem 0;
		font-weight: 600;
	}

	.header-actions {
		display: flex;
		align-items: center;
		gap: 1rem;
		margin-top: 1rem;
	}

	.back-link {
		color: #16a085;
		text-decoration: none;
		font-weight: 600;
		transition: color 0.2s;
	}

	.back-link:hover {
		color: #138d75;
		text-decoration: underline;
	}

	.refresh-btn {
		padding: 0.5rem 1rem;
		background: #3498db;
		color: white;
		border: none;
		border-radius: 4px;
		font-weight: 600;
		cursor: pointer;
		transition: background 0.2s;
	}

	.refresh-btn:hover:not(:disabled) {
		background: #2980b9;
	}

	.refresh-btn:disabled {
		background: #bdc3c7;
		cursor: not-allowed;
	}

	.error-banner {
		background: #f8d7da;
		border: 1px solid #f5c6cb;
		color: #721c24;
		padding: 1rem;
		border-radius: 8px;
		margin-bottom: 1rem;
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.error-banner p {
		margin: 0;
	}

	.error-banner button {
		padding: 0.5rem 1rem;
		background: #dc3545;
		color: white;
		border: none;
		border-radius: 4px;
		cursor: pointer;
	}

	.loading-state {
		text-align: center;
		padding: 3rem;
		color: #7f8c8d;
	}

	.orders-container {
		background: #fff;
		border-radius: 8px;
		box-shadow: 0 2px 8px rgba(0,0,0,0.1);
		padding: 2rem;
	}

	.empty-state {
		text-align: center;
		padding: 3rem;
		color: #7f8c8d;
		font-size: 1.2rem;
	}

	.orders-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
		gap: 1.5rem;
	}

	.order-card {
		border: 2px solid #ecf0f1;
		border-radius: 12px;
		padding: 1.5rem;
		background: #fafafa;
		transition: all 0.3s;
	}

	.order-card:hover {
		border-color: #16a085;
		box-shadow: 0 4px 12px rgba(0,0,0,0.1);
	}

	.order-card.updating {
		opacity: 0.6;
		pointer-events: none;
	}

	.customer-name {
		font-size: 0.875rem;
		color: #2c3e50;
		font-weight: 600;
		margin-left: 0.5rem;
	}

	.order-header {
		margin-bottom: 1rem;
		padding-bottom: 1rem;
		border-bottom: 2px solid #ecf0f1;
	}

	.order-id-section {
		display: flex;
		align-items: center;
		gap: 1rem;
		margin-bottom: 0.5rem;
	}

	.order-id {
		font-size: 1.25rem;
		font-weight: 700;
		color: #2c3e50;
	}

	.status-badge {
		padding: 0.25rem 0.75rem;
		border-radius: 12px;
		color: white;
		font-size: 0.75rem;
		font-weight: 600;
		text-transform: uppercase;
	}

	.bowl-info {
		display: flex;
		align-items: center;
	}

	.bowl-size-label {
		font-size: 0.875rem;
		color: #7f8c8d;
		font-weight: 600;
	}

	.order-details {
		margin-bottom: 1rem;
	}

	.order-details h3 {
		color: #34495e;
		font-size: 1rem;
		margin: 0 0 0.75rem 0;
	}

	.ingredients-list {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.ingredient-row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem;
		background: #fff;
		border-radius: 6px;
	}

	.seq-number {
		font-weight: 700;
		color: #16a085;
		min-width: 20px;
	}

	.ingredient-name {
		flex: 1;
		color: #2c3e50;
		font-weight: 600;
	}

	.ingredient-qty {
		color: #7f8c8d;
		font-weight: 600;
	}

	.order-summary {
		margin-bottom: 1rem;
		padding: 1rem;
		background: #fff;
		border-radius: 8px;
	}

	.summary-item {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0.25rem 0;
	}

	.summary-item .label {
		color: #7f8c8d;
		font-size: 0.875rem;
	}

	.summary-item .value {
		color: #2c3e50;
		font-weight: 600;
	}

	.order-actions {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.status-label {
		font-size: 0.875rem;
		color: #7f8c8d;
		font-weight: 600;
	}

	.status-select {
		width: 100%;
		padding: 0.75rem;
		border: 2px solid #ecf0f1;
		border-radius: 6px;
		font-size: 1rem;
		font-weight: 600;
		cursor: pointer;
		background: white;
		transition: border-color 0.2s;
	}

	.status-select:hover:not(:disabled) {
		border-color: #16a085;
	}

	.status-select:focus {
		outline: none;
		border-color: #16a085;
	}

	.status-select:disabled {
		background: #f5f5f5;
		cursor: not-allowed;
	}

	/* Responsive Design */
	@media (max-width: 768px) {
		main {
			padding: 1rem;
		}

		.orders-grid {
			grid-template-columns: 1fr;
		}

		.order-actions {
			flex-direction: column;
		}
	}
</style>
