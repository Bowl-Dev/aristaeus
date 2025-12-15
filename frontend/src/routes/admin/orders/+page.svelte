<script lang="ts">
	// TEMPORARY ADMIN VIEW FOR TESTING ONLY
	// This route is not part of the official application spec
	// DO NOT DOCUMENT - for internal testing only

	interface OrderItem {
		ingredient_name: string;
		quantity_grams: number;
		sequence_order: number;
	}

	interface Order {
		id: number;
		bowl_size: number;
		status: string;
		items: OrderItem[];
		total_weight_g: number;
		total_calories: number;
		created_at: string;
	}

	// Mock orders data for testing
	// TODO: Replace with actual API call
	let orders = $state<Order[]>([
		{
			id: 1,
			bowl_size: 320,
			status: 'pending',
			items: [
				{ ingredient_name: 'Grilled Chicken', quantity_grams: 150, sequence_order: 1 },
				{ ingredient_name: 'Quinoa', quantity_grams: 100, sequence_order: 2 },
				{ ingredient_name: 'Cherry Tomatoes', quantity_grams: 50, sequence_order: 3 }
			],
			total_weight_g: 300,
			total_calories: 380,
			created_at: new Date().toISOString()
		},
		{
			id: 2,
			bowl_size: 250,
			status: 'preparing',
			items: [
				{ ingredient_name: 'Tofu', quantity_grams: 100, sequence_order: 1 },
				{ ingredient_name: 'Mixed Greens', quantity_grams: 80, sequence_order: 2 },
				{ ingredient_name: 'Avocado', quantity_grams: 50, sequence_order: 3 }
			],
			total_weight_g: 230,
			total_calories: 220,
			created_at: new Date(Date.now() - 300000).toISOString()
		},
		{
			id: 3,
			bowl_size: 480,
			status: 'ready',
			items: [
				{ ingredient_name: 'Hard Boiled Egg', quantity_grams: 100, sequence_order: 1 },
				{ ingredient_name: 'Brown Rice', quantity_grams: 200, sequence_order: 2 },
				{ ingredient_name: 'Shredded Carrot', quantity_grams: 80, sequence_order: 3 },
				{ ingredient_name: 'Cucumber', quantity_grams: 80, sequence_order: 4 }
			],
			total_weight_g: 460,
			total_calories: 510,
			created_at: new Date(Date.now() - 600000).toISOString()
		}
	]);

	// Status badge colors
	const statusColors: Record<string, string> = {
		pending: '#95a5a6',
		queued: '#3498db',
		assigned: '#f39c12',
		preparing: '#e67e22',
		ready: '#27ae60',
		completed: '#16a085',
		failed: '#e74c3c'
	};

	function formatDate(dateString: string): string {
		const date = new Date(dateString);
		return date.toLocaleString();
	}
</script>

<main>
	<div class="admin-header">
		<h1>⚙️ Admin - Order Management</h1>
		<p class="admin-warning">⚠️ Testing Only - Not Part of Official Application</p>
		<a href="/" class="back-link">← Back to Bowl Builder</a>
	</div>

	<div class="orders-container">
		{#if orders.length === 0}
			<div class="empty-state">
				<p>No orders yet</p>
			</div>
		{:else}
			<div class="orders-grid">
				{#each orders as order}
					<div class="order-card">
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
								<span class="bowl-size-label">Bowl: {order.bowl_size}g</span>
							</div>
						</div>

						<div class="order-details">
							<h3>Ingredients</h3>
							<div class="ingredients-list">
								{#each order.items.sort((a, b) => a.sequence_order - b.sequence_order) as item}
									<div class="ingredient-row">
										<span class="seq-number">{item.sequence_order}.</span>
										<span class="ingredient-name">{item.ingredient_name}</span>
										<span class="ingredient-qty">{item.quantity_grams}g</span>
									</div>
								{/each}
							</div>
						</div>

						<div class="order-summary">
							<div class="summary-item">
								<span class="label">Total Weight:</span>
								<span class="value">{order.total_weight_g}g / {order.bowl_size}g</span>
							</div>
							<div class="summary-item">
								<span class="label">Calories:</span>
								<span class="value">{order.total_calories}</span>
							</div>
							<div class="summary-item">
								<span class="label">Created:</span>
								<span class="value">{formatDate(order.created_at)}</span>
							</div>
						</div>

						<div class="order-actions">
							<button class="action-btn" onclick={() => alert(`Update status for order ${order.id}`)}>
								Update Status
							</button>
							<button class="action-btn secondary" onclick={() => alert(`View details for order ${order.id}`)}>
								View Details
							</button>
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
		gap: 0.5rem;
	}

	.action-btn {
		flex: 1;
		padding: 0.75rem;
		background: #16a085;
		color: white;
		border: none;
		border-radius: 6px;
		font-weight: 600;
		cursor: pointer;
		transition: background 0.2s;
	}

	.action-btn:hover {
		background: #138d75;
	}

	.action-btn.secondary {
		background: #95a5a6;
	}

	.action-btn.secondary:hover {
		background: #7f8c8d;
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
