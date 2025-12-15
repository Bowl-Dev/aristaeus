<script lang="ts">
	// Aristaeus - Automated Bowl Kitchen
	import type { Ingredient, BowlSize, NutritionalSummary as NutritionalSummaryType } from '$lib/types';
	import IngredientCard from '$lib/components/IngredientCard.svelte';
	import BowlSizeSelector from '$lib/components/BowlSizeSelector.svelte';
	import NutritionalSummary from '$lib/components/NutritionalSummary.svelte';
	import { _, } from 'svelte-i18n';


	// Mock ingredient data (will be replaced with API call)
	// Data sourced from Bowls Request Form.xlsx - "Precios en bowl" sheet
	const ingredients: Ingredient[] = [
		// Proteins
		{ id: 1, name: 'Chicken', category: 'protein', caloriesPer100g: 165, proteinGPer100g: 31, carbsGPer100g: 0, fatGPer100g: 3.7, fiberGPer100g: 0, available: true, displayOrder: 1 },
		{ id: 2, name: 'Salmon', category: 'protein', caloriesPer100g: 208, proteinGPer100g: 20, carbsGPer100g: 0, fatGPer100g: 13, fiberGPer100g: 0, available: true, displayOrder: 2 },

		// Bases
		{ id: 3, name: 'Rice', category: 'base', caloriesPer100g: 130, proteinGPer100g: 2.6, carbsGPer100g: 28, fatGPer100g: 0.2, fiberGPer100g: 0.3, available: true, displayOrder: 1 },
		{ id: 4, name: 'Quinoa', category: 'base', caloriesPer100g: 120, proteinGPer100g: 4.3, carbsGPer100g: 21, fatGPer100g: 1.8, fiberGPer100g: 1.3, available: true, displayOrder: 2 },

		// Vegetables
		{ id: 5, name: 'Cherry Tomatoes', category: 'vegetable', caloriesPer100g: 18, proteinGPer100g: 0.9, carbsGPer100g: 3.9, fatGPer100g: 0.2, fiberGPer100g: 1.2, available: true, displayOrder: 1 },
		{ id: 6, name: 'Mango', category: 'vegetable', caloriesPer100g: 60, proteinGPer100g: 0.5, carbsGPer100g: 15, fatGPer100g: 0.2, fiberGPer100g: 1.7, available: true, displayOrder: 2 },
		{ id: 7, name: 'Carrot', category: 'vegetable', caloriesPer100g: 41, proteinGPer100g: 0.9, carbsGPer100g: 9.5, fatGPer100g: 0.2, fiberGPer100g: 2.8, available: true, displayOrder: 3 },
		{ id: 8, name: 'Onion', category: 'vegetable', caloriesPer100g: 40, proteinGPer100g: 1.1, carbsGPer100g: 9.3, fatGPer100g: 0.1, fiberGPer100g: 1.0, available: true, displayOrder: 4 },
		{ id: 9, name: 'Avocado', category: 'vegetable', caloriesPer100g: 160, proteinGPer100g: 2.0, carbsGPer100g: 0.9, fatGPer100g: 15, fiberGPer100g: 6.7, available: true, displayOrder: 5 },
		{ id: 10, name: 'Corn', category: 'vegetable', caloriesPer100g: 96, proteinGPer100g: 3.2, carbsGPer100g: 21, fatGPer100g: 1.5, fiberGPer100g: 2.6, available: true, displayOrder: 6 },
		{ id: 11, name: 'Cucumber', category: 'vegetable', caloriesPer100g: 16, proteinGPer100g: 0.7, carbsGPer100g: 3.6, fatGPer100g: 0.1, fiberGPer100g: 0.5, available: true, displayOrder: 7 },

		// Toppings
		{ id: 12, name: 'Mozzarella', category: 'topping', caloriesPer100g: 300, proteinGPer100g: 20, carbsGPer100g: 1.0, fatGPer100g: 18, fiberGPer100g: 0, available: true, displayOrder: 1 },
		{ id: 13, name: 'Green Onion', category: 'topping', caloriesPer100g: 32, proteinGPer100g: 0.9, carbsGPer100g: 7.4, fatGPer100g: 0.05, fiberGPer100g: 0.8, available: true, displayOrder: 2 },
		{ id: 14, name: 'Peanuts', category: 'topping', caloriesPer100g: 600, proteinGPer100g: 25, carbsGPer100g: 16, fatGPer100g: 52, fiberGPer100g: 10, available: true, displayOrder: 3 },

		// Dressings
		{ id: 15, name: 'Teriyaki', category: 'dressing', caloriesPer100g: 89, proteinGPer100g: 6, carbsGPer100g: 16, fatGPer100g: 0, fiberGPer100g: 0, available: true, displayOrder: 1 },
		{ id: 16, name: 'Olive Oil Balsamic', category: 'dressing', caloriesPer100g: 415, proteinGPer100g: 0, carbsGPer100g: 8.5, fatGPer100g: 45.5, fiberGPer100g: 0, available: true, displayOrder: 2 }
	];

	// Group ingredients by category
	const ingredientsByCategory = $derived.by(() => {
		const grouped: Record<string, Ingredient[]> = {};
		ingredients.forEach(ingredient => {
			if (!grouped[ingredient.category]) {
				grouped[ingredient.category] = [];
			}
			grouped[ingredient.category].push(ingredient);
		});
		return grouped;
	});

	// State
	let customerName = $state('');
	let selectedBowlSize = $state<BowlSize | null>(null);
	let selectedItems = $state<Map<number, number>>(new Map()); // ingredientId -> quantityGrams

	// Calculate nutritional summary
	const nutritionalSummary = $derived.by((): NutritionalSummaryType => {
		let totals: NutritionalSummaryType = {
			calories: 0,
			proteinG: 0,
			carbsG: 0,
			fatG: 0,
			fiberG: 0,
			totalWeightG: 0
		};

		selectedItems.forEach((quantityGrams, ingredientId) => {
			const ingredient = ingredients.find(i => i.id === ingredientId);
			if (ingredient && quantityGrams > 0) {
				const multiplier = quantityGrams / 100;
				totals.calories += ingredient.caloriesPer100g * multiplier;
				totals.proteinG += ingredient.proteinGPer100g * multiplier;
				totals.carbsG += ingredient.carbsGPer100g * multiplier;
				totals.fatG += ingredient.fatGPer100g * multiplier;
				totals.fiberG += (ingredient.fiberGPer100g || 0) * multiplier;
				totals.totalWeightG += quantityGrams;
			}
		});

		return totals;
	});

	// Calculate remaining capacity
	const remainingCapacity = $derived(
		selectedBowlSize ? selectedBowlSize - nutritionalSummary.totalWeightG : null
	);

	// Check if capacity is exceeded
	const capacityExceeded = $derived(
		remainingCapacity !== null && remainingCapacity < 0
	);

	// Check if form is valid
	const isFormValid = $derived(
		customerName.trim().length > 0 &&
		selectedBowlSize !== null &&
		selectedItems.size > 0 &&
		!capacityExceeded
	);

	// Update ingredient quantity
	function updateQuantity(ingredientId: number, quantity: number) {
		// Create new Map to trigger reactivity (Svelte 5 runes requirement)
		const newMap = new Map(selectedItems);
		if (quantity > 0) {
			newMap.set(ingredientId, quantity);
		} else {
			newMap.delete(ingredientId);
		}
		selectedItems = newMap;
	}

	// Submit order
	async function submitOrder() {
		if (!isFormValid || !selectedBowlSize) return;

		const items: Array<{ ingredientId: number; quantityGrams: number }> = [];

		selectedItems.forEach((quantityGrams, ingredientId) => {
			items.push({
				ingredientId,
				quantityGrams
			});
		});

		const orderData: import('@aristaeus/shared').CreateOrderRequest = {
			customerName: customerName,
			bowlSize: selectedBowlSize,
			items: items
		};

		console.log('Submitting order:', orderData);
		// TODO: Replace with actual API call
		alert($_('order.submitted', {
			values: {
				name: customerName,
				size: selectedBowlSize,
				weight: nutritionalSummary.totalWeightG.toFixed(0),
				calories: nutritionalSummary.calories.toFixed(0)
			}
		}));
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

	<div class="form-container">
		<!-- Customer Name Section -->
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
		</section>

		<!-- Bowl Size Selection -->
		<BowlSizeSelector
			selectedSize={selectedBowlSize}
			onSizeChange={(size) => selectedBowlSize = size}
		/>

		<!-- Ingredient Selection Section -->
		<section class="ingredient-selection">
			<h2>{$_('ingredients.title')}</h2>

			{#each Object.entries(ingredientsByCategory) as [category, items]}
				<div class="category-group">
					<h3>{getCategoryName(category)}</h3>
					<div class="ingredient-grid">
						{#each items as ingredient}
							<IngredientCard
								{ingredient}
								ingredientName={getIngredientName(ingredient.name)}
								isSelected={selectedItems.has(ingredient.id)}
								quantity={selectedItems.get(ingredient.id) || 0}
								onSelect={() => updateQuantity(ingredient.id, 50)}
								onRemove={() => updateQuantity(ingredient.id, 0)}
								onQuantityChange={(qty) => updateQuantity(ingredient.id, qty)}
							/>
						{/each}
					</div>
				</div>
			{/each}
		</section>

		<!-- Nutritional Summary -->
		<NutritionalSummary nutrition={nutritionalSummary} bowlSize={selectedBowlSize} />

		<!-- Submit Button -->
		<div class="submit-section">
			<button
				class="submit-button"
				disabled={!isFormValid}
				onclick={submitOrder}
			>
				{$_('order.submit')}
			</button>
		</div>
	</div>
</main>

<style>
	main {
		padding: 2rem;
		max-width: 1200px;
		margin: 0 auto;
		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
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
		box-shadow: 0 2px 8px rgba(0,0,0,0.1);
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

	.input-group input[type="text"] {
		padding: 0.75rem;
		border: 2px solid #ecf0f1;
		border-radius: 4px;
		font-size: 1rem;
		transition: border-color 0.3s;
	}

	.input-group input[type="text"]:focus {
		outline: none;
		border-color: #16a085;
	}

	/* Ingredient Selection */
	.category-group {
		margin-bottom: 2rem;
	}

	.ingredient-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
		gap: 1rem;
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
		transition: background-color 0.3s, transform 0.1s;
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
