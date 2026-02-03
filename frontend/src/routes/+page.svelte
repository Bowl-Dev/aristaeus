<script lang="ts">
	// Aristaeus - Automated Bowl Kitchen
	import {
		type Ingredient,
		type BowlSize,
		type NutritionalSummary as NutritionalSummaryType,
		BOWL_SIZES,
		BOWL_SIZE_PRICES
	} from '$lib/types';
	import { SvelteMap } from 'svelte/reactivity';
	import IngredientCard from '$lib/components/IngredientCard.svelte';
	import BowlSizeSelector from '$lib/components/BowlSizeSelector.svelte';
	import NutritionalSummary from '$lib/components/NutritionalSummary.svelte';
	import { _ } from 'svelte-i18n';
	import { getIngredients, createOrder, ApiError } from '$lib/api/client';

	let yes = $state(false); //Variable for the default bowl checkbox
	let isCutlery = $state(false); //Variable for checking if customer wants cutlery

	// Ingredients fetched from API
	let ingredients = $state<Ingredient[]>([]);

	// Loading and error states
	let loading = $state(true);
	let error = $state<string | null>(null);
	let submitting = $state(false);
	let orderSuccess = $state<{ orderId: number; status: string } | null>(null);

	// Fetch ingredients on mount
	async function loadIngredients() {
		loading = true;
		error = null;
		try {
			ingredients = await getIngredients();
		} catch (e) {
			error = e instanceof ApiError ? e.message : 'Failed to load ingredients';
			console.error('Failed to fetch ingredients:', e);
		} finally {
			loading = false;
		}
	}

	// Load ingredients when component mounts
	$effect(() => {
		loadIngredients();
	});

	// Group ingredients by category
	const ingredientsByCategory = $derived.by(() => {
		const grouped: Record<string, Ingredient[]> = {};
		ingredients.forEach((ingredient) => {
			if (!grouped[ingredient.category]) {
				grouped[ingredient.category] = [];
			}
			grouped[ingredient.category].push(ingredient);
		});
		return grouped;
	});

	//Set priority to category, sets the order in which categories are shown
	const priority: Record<string, number> = {
		base: 0,
		vegetable: 1,
		protein: 2,
		topping: 3,
		dressing: 4
	};
	//let cat:string[] = $derived(Object.keys(ingredientsByCategory));
	let orderedCategories = $derived(
		Object.fromEntries(
			Object.entries(ingredientsByCategory).sort(([a], [b]) => {
				const orderA = priority[a] ?? 999;
				const orderB = priority[b] ?? 999;
				return orderA - orderB;
			})
		)
	);

	//$inspect(ingredients);
	//let cat:string[] = $derived(Object.keys(orderedCategories));

	// State
	let customerName = $state('');
	let customerPhone = $state('');
	let selectedBowlSize = $state<BowlSize | null>(null);
	let selectedItems = new SvelteMap<number, number>(); // ingredientId -> quantityGrams

	// Functions for selecting a predefined bowl
	function setDefaultBowlSize() {
		return (selectedBowlSize = BOWL_SIZES[1]);
	}
	function setDefaultBowlIng() {
		return (selectedItems = new SvelteMap([
			[107, 40],
			[102, 140],
			[104, 40],
			[106, 40],
			[108, 40],
			[100, 120],
			[115, 25]
		]));
	}

	// Calculate nutritional summary
	//const priceMult = (1/0.33); //Define multiplier for charging the customer
	const nutritionalSummary = $derived.by((): NutritionalSummaryType => {
		let totals: NutritionalSummaryType = {
			calories: 0,
			proteinG: 0,
			carbsG: 0,
			fatG: 0,
			fiberG: 0,
			totalWeightG: 0,
			totalPrice: 0
		};
		if (selectedBowlSize == BOWL_SIZES[0]) {
			//Where the prices of the packaging are shown
			totals.totalPrice = BOWL_SIZE_PRICES[0];
		}
		if (selectedBowlSize == BOWL_SIZES[1]) {
			totals.totalPrice = BOWL_SIZE_PRICES[1];
		}
		if (selectedBowlSize == BOWL_SIZES[2]) {
			totals.totalPrice = BOWL_SIZE_PRICES[2];
		}
		if (isCutlery == true) {
			totals.totalPrice += 300;
		}

		selectedItems.forEach((quantityGrams, ingredientId) => {
			const ingredient = ingredients.find((i) => i.id === ingredientId);
			if (ingredient && quantityGrams > 0) {
				const multiplier = quantityGrams / 100;
				totals.calories += ingredient.caloriesPer100g * multiplier;
				totals.proteinG += ingredient.proteinGPer100g * multiplier;
				totals.carbsG += ingredient.carbsGPer100g * multiplier;
				totals.fatG += ingredient.fatGPer100g * multiplier;
				totals.fiberG += (ingredient.fiberGPer100g || 0) * multiplier;
				totals.totalWeightG += quantityGrams;
				totals.totalPrice += ingredient.pricePerG * (multiplier * 100);
			}
		});

		return totals;
	});

	// Calculate remaining capacity
	const remainingCapacity = $derived(
		selectedBowlSize ? selectedBowlSize - nutritionalSummary.totalWeightG : null
	);

	// Check if capacity is exceeded
	const capacityExceeded = $derived(remainingCapacity !== null && remainingCapacity < 0);

	// Check if form is valid
	const isFormValid = $derived(
		customerName.trim().length > 0 &&
			selectedBowlSize !== null &&
			selectedItems.size > 0 &&
			!capacityExceeded
	);

	// Update ingredient quantity
	function updateQuantity(ingredientId: number, quantity: number) {
		// SvelteMap is reactive, so we can mutate it directly
		if (quantity > 0) {
			selectedItems.set(ingredientId, quantity);
		} else {
			selectedItems.delete(ingredientId);
		}
	}

	// Submit order
	async function submitOrder() {
		if (!isFormValid || !selectedBowlSize) return;

		submitting = true;
		orderSuccess = null;

		try {
			const items = Array.from(selectedItems.entries()).map(([ingredientId, quantityGrams]) => ({
				ingredientId,
				quantityGrams
			}));

			const response = await createOrder({
				customerName,
				bowlSize: selectedBowlSize,
				items
			});

			// Success - show confirmation and reset form
			orderSuccess = { orderId: response.orderId, status: response.status };
			customerName = '';
			selectedBowlSize = null;
			selectedItems = new SvelteMap();
		} catch (e) {
			const message = e instanceof ApiError ? e.message : 'Failed to submit order';
			alert(`Error: ${message}`);
			console.error('Order submission failed:', e);
		} finally {
			submitting = false;
		}
	}

	// Category display names (now using i18n)
	function getCategoryName(category: string): string {
		return $_(`ingredients.categories.${category}`);
	}

	// Get translated ingredient name
	function getIngredientName(name: string): string {
		return $_(`ingredients.names.${name}`);
	}
</script>

<main>
	<h1>{$_('app.title')}</h1>
	<p class="subtitle">{$_('app.subtitle')}</p>

	{#if orderSuccess}
		<div class="success-banner">
			<p>Order #{orderSuccess.orderId} created successfully!</p>
			<p>Status: {orderSuccess.status}</p>
			<button onclick={() => (orderSuccess = null)}>Create Another Order</button>
		</div>
	{/if}

	{#if error}
		<div class="error-banner">
			<p>{error}</p>
			<button onclick={loadIngredients}>Try Again</button>
		</div>
	{/if}

	<div class="form-container">
		<!-- Customer Name and Phone Section-->
		<section class="customer-info">
			<h2>{$_('customerInfo.title')}</h2>
			<div class="input-group">
				<label for="customer-name">{$_('customerInfo.nameLabel')}</label>
				<input
					id="customer-name"
					type="text"
					bind:value={customerName}
					placeholder={$_('customerInfo.namePlaceholder')}
					required
				/>
			</div>
			<br />
			<div class="input-group">
				<label for="customer-phone">{$_('customerInfo.phoneLabel')}</label>
				<input
					id="customer-phone"
					type="text"
					bind:value={customerPhone}
					placeholder={$_('customerInfo.phonePlaceholder')}
					required
				/>
			</div>
		</section>
		<div class="default-bowl">
			<label>
				<input
					type="checkbox"
					bind:checked={yes}
					onchange={() => {
						setDefaultBowlSize();
						setDefaultBowlIng();
					}}
				/>
				{$_('app.defaultBowl')}
			</label>
		</div>
		<br />

		<!-- Bowl Size Selection -->
		<BowlSizeSelector
			selectedSize={selectedBowlSize}
			onSizeChange={(size) => (selectedBowlSize = size)}
		/>

		<!-- Ingredient Selection Section -->
		<section class="ingredient-selection">
			<h2>{$_('ingredients.title')}</h2>

			{#if loading}
				<div class="loading-state">
					<p>Loading ingredients...</p>
				</div>
			{:else if ingredients.length === 0}
				<div class="empty-state">
					<p>No ingredients available at this time.</p>
				</div>
			{:else}
				{#each Object.entries(orderedCategories) as [category, items] (category)}
					<div class="category-group">
						<!--{#if getCategoryName(category) != $_('ingredients.categories.dressing')}-->
						<h3>{getCategoryName(category)}</h3>
						<div class="ingredient-grid">
							{#each items as ingredient (ingredient.id)}
								<IngredientCard
									{ingredient}
									ingredientName={getIngredientName(ingredient.name)}
									ingredientCategory={getCategoryName(category)}
									isSelected={selectedItems.has(ingredient.id)}
									quantity={selectedItems.get(ingredient.id) || 0}
									onSelect={() => updateQuantity(ingredient.id, 50)}
									onRemove={() => updateQuantity(ingredient.id, 0)}
									onQuantityChange={(qty) => updateQuantity(ingredient.id, qty)}
								/>
							{/each}
						</div>
						<!--{/if}-->
					</div>
				{/each}
			{/if}
		</section>

		<!-- Cutelry check -->
		<div class="default-bowl">
			<label>
				<input type="checkbox" bind:checked={isCutlery} />
				{$_('app.cutlery')}
			</label>
		</div>
		<br />

		<!-- Nutritional Summary -->
		<NutritionalSummary nutrition={nutritionalSummary} bowlSize={selectedBowlSize} />

		<!-- Submit Button -->
		<div class="submit-section">
			<button class="submit-button" disabled={!isFormValid || submitting} onclick={submitOrder}>
				{#if submitting}
					Submitting...
				{:else}
					{$_('order.submit')}
				{/if}
			</button>
		</div>
	</div>
</main>

<style>
	main {
		padding: 2rem;
		max-width: 1200px;
		margin: 0 auto;
		font-family:
			-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
	}

	h1 {
		color: #2c3e50;
		font-size: 2.5rem;
		margin-bottom: 0.5rem;
	}

	.subtitle {
		color: #7f8c8d;
		font-size: 1.2rem;
		margin-bottom: 2rem;
	}

	.form-container {
		background: #fff;
		border-radius: 8px;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
		padding: 2rem;
	}

	section {
		margin-bottom: 2rem;
		padding-bottom: 2rem;
		border-bottom: 1px solid #ecf0f1;
	}

	section:last-of-type {
		border-bottom: none;
	}

	h2 {
		color: #34495e;
		font-size: 1.5rem;
		margin-bottom: 1rem;
	}

	h3 {
		color: #16a085;
		font-size: 1.2rem;
		margin-bottom: 0.75rem;
		text-transform: capitalize;
	}

	/* Customer Info */
	.input-group {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.input-group label {
		font-weight: 600;
		color: #34495e;
	}

	.input-group input[type='text'] {
		padding: 0.75rem;
		border: 2px solid #ecf0f1;
		border-radius: 4px;
		font-size: 1rem;
		transition: border-color 0.3s;
	}

	.input-group input[type='text']:focus {
		outline: none;
		border-color: #16a085;
	}

	.default-bowl label {
		font-size: 1.6rem;
		outline: none;
		font-weight: bold;
		color: #34495e;
		margin-bottom: 1rem;
	}
	.default-bowl input[type='checkbox'] {
		transform: scale(1.5);
		vertical-align: middle;
		width: 1.5em;
		height: 1.5em;
	}

	/* Ingredient Selection */
	.category-group {
		margin-bottom: 2rem;
		justify-content: center;
	}

	.ingredient-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
		gap: 1rem;
		justify-content: center;
	}

	/* Submit Section */
	.submit-section {
		display: flex;
		justify-content: center;
		padding-top: 1rem;
	}

	.submit-button {
		padding: 1rem 3rem;
		background: #16a085;
		color: white;
		border: none;
		border-radius: 4px;
		font-size: 1.125rem;
		font-weight: 600;
		cursor: pointer;
		transition:
			background-color 0.3s,
			transform 0.1s;
	}

	.submit-button:hover:not(:disabled) {
		background: #138d75;
		transform: translateY(-2px);
	}

	.submit-button:active:not(:disabled) {
		transform: translateY(0);
	}

	.submit-button:disabled {
		background: #bdc3c7;
		cursor: not-allowed;
	}

	/* Success Banner */
	.success-banner {
		background: #d4edda;
		border: 1px solid #c3e6cb;
		color: #155724;
		padding: 1.5rem;
		border-radius: 8px;
		margin-bottom: 2rem;
		text-align: center;
	}

	.success-banner p {
		margin: 0.5rem 0;
	}

	.success-banner button {
		margin-top: 1rem;
		padding: 0.5rem 1.5rem;
		background: #28a745;
		color: white;
		border: none;
		border-radius: 4px;
		cursor: pointer;
		font-weight: 600;
	}

	.success-banner button:hover {
		background: #218838;
	}

	/* Error Banner */
	.error-banner {
		background: #f8d7da;
		border: 1px solid #f5c6cb;
		color: #721c24;
		padding: 1.5rem;
		border-radius: 8px;
		margin-bottom: 2rem;
		text-align: center;
	}

	.error-banner p {
		margin: 0.5rem 0;
	}

	.error-banner button {
		margin-top: 1rem;
		padding: 0.5rem 1.5rem;
		background: #dc3545;
		color: white;
		border: none;
		border-radius: 4px;
		cursor: pointer;
		font-weight: 600;
	}

	.error-banner button:hover {
		background: #c82333;
	}

	/* Loading State */
	.loading-state {
		text-align: center;
		padding: 3rem;
		color: #7f8c8d;
	}

	/* Empty State */
	.empty-state {
		text-align: center;
		padding: 3rem;
		color: #7f8c8d;
	}

	/* Responsive Design */
	@media (max-width: 768px) {
		main {
			padding: 1rem;
		}

		.form-container {
			padding: 1rem;
		}

		.ingredient-grid {
			grid-template-columns: 1fr;
		}
	}
</style>
