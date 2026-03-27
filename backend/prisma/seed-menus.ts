/**
 * Aristaeus Safe Menu Seed Script
 * Adds menus and ingredients WITHOUT clearing any existing data.
 * Safe to run against a database that already has orders.
 *
 * Strategy:
 * 1. Fetch all existing ingredients by name — only create missing ones
 * 2. Build a name→id lookup map from ALL ingredients (existing + newly created)
 * 3. Fetch all existing menus by nameEs — only create missing ones
 * 4. For each missing menu, create the menu + its MenuIngredient records
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// Ingredient definitions (source of truth: seed.ts)
// ---------------------------------------------------------------------------

const ingredientData = [
	// Proteins
	{
		name: 'Chicken',
		category: 'protein',
		caloriesPer100g: 165,
		proteinGPer100g: 31,
		carbsGPer100g: 0,
		fatGPer100g: 3.7,
		fiberGPer100g: 0,
		pricePerG: 25.2,
		available: true,
		displayOrder: 1
	},
	{
		name: 'Salmon',
		category: 'protein',
		caloriesPer100g: 208,
		proteinGPer100g: 20,
		carbsGPer100g: 0,
		fatGPer100g: 13,
		fiberGPer100g: 0,
		pricePerG: 90,
		available: true,
		displayOrder: 2
	},
	{
		name: 'Mushroom',
		category: 'protein',
		caloriesPer100g: 24,
		proteinGPer100g: 3,
		carbsGPer100g: 3,
		fatGPer100g: 0.3,
		fiberGPer100g: 2.5,
		pricePerG: 27,
		available: true,
		displayOrder: 2
	},

	// Bases
	{
		name: 'Rice',
		category: 'base',
		caloriesPer100g: 130,
		proteinGPer100g: 2.6,
		carbsGPer100g: 28,
		fatGPer100g: 0.2,
		fiberGPer100g: 0.3,
		pricePerG: 1.9,
		available: true,
		displayOrder: 1
	},
	{
		name: 'Quinoa',
		category: 'base',
		caloriesPer100g: 120,
		proteinGPer100g: 4.3,
		carbsGPer100g: 21,
		fatGPer100g: 1.8,
		fiberGPer100g: 1.3,
		pricePerG: 10,
		available: true,
		displayOrder: 2
	},

	// Vegetables
	{
		name: 'Cherry Tomatoes',
		category: 'vegetable',
		caloriesPer100g: 18,
		proteinGPer100g: 0.9,
		carbsGPer100g: 3.9,
		fatGPer100g: 0.2,
		fiberGPer100g: 1.2,
		pricePerG: 8,
		available: true,
		displayOrder: 1
	},
	{
		name: 'Mango',
		category: 'vegetable',
		caloriesPer100g: 60,
		proteinGPer100g: 0.5,
		carbsGPer100g: 15,
		fatGPer100g: 0.2,
		fiberGPer100g: 1.7,
		pricePerG: 11.4,
		available: true,
		displayOrder: 2
	},
	{
		name: 'Carrot',
		category: 'vegetable',
		caloriesPer100g: 41,
		proteinGPer100g: 0.9,
		carbsGPer100g: 9.5,
		fatGPer100g: 0.2,
		fiberGPer100g: 2.8,
		pricePerG: 6.7,
		available: true,
		displayOrder: 3
	},
	{
		name: 'Onion',
		category: 'vegetable',
		caloriesPer100g: 40,
		proteinGPer100g: 1.1,
		carbsGPer100g: 9.3,
		fatGPer100g: 0.1,
		fiberGPer100g: 1.0,
		pricePerG: 3.3,
		available: true,
		displayOrder: 4
	},
	{
		name: 'Avocado',
		category: 'vegetable',
		caloriesPer100g: 160,
		proteinGPer100g: 2.0,
		carbsGPer100g: 0.9,
		fatGPer100g: 15,
		fiberGPer100g: 6.7,
		pricePerG: 12.5,
		available: true,
		displayOrder: 5
	},
	{
		name: 'Corn',
		category: 'vegetable',
		caloriesPer100g: 96,
		proteinGPer100g: 3.2,
		carbsGPer100g: 21,
		fatGPer100g: 1.5,
		fiberGPer100g: 2.6,
		pricePerG: 12,
		available: true,
		displayOrder: 6
	},
	{
		name: 'Cucumber',
		category: 'vegetable',
		caloriesPer100g: 16,
		proteinGPer100g: 0.7,
		carbsGPer100g: 3.6,
		fatGPer100g: 0.1,
		fiberGPer100g: 0.5,
		pricePerG: 3,
		available: true,
		displayOrder: 7
	},

	// Toppings
	{
		name: 'Mozzarella',
		category: 'topping',
		caloriesPer100g: 300,
		proteinGPer100g: 20,
		carbsGPer100g: 1.0,
		fatGPer100g: 18,
		fiberGPer100g: 0,
		pricePerG: 36,
		available: true,
		displayOrder: 1
	},
	{
		name: 'Green Onion',
		category: 'topping',
		caloriesPer100g: 32,
		proteinGPer100g: 0.9,
		carbsGPer100g: 7.4,
		fatGPer100g: 0.05,
		fiberGPer100g: 0.8,
		pricePerG: 8,
		available: true,
		displayOrder: 2
	},
	{
		name: 'Peanuts',
		category: 'topping',
		caloriesPer100g: 600,
		proteinGPer100g: 25,
		carbsGPer100g: 16,
		fatGPer100g: 52,
		fiberGPer100g: 10,
		pricePerG: 16,
		available: true,
		displayOrder: 3
	},

	// Dressings
	{
		name: 'Teriyaki',
		category: 'dressing',
		caloriesPer100g: 89,
		proteinGPer100g: 6,
		carbsGPer100g: 16,
		fatGPer100g: 0,
		fiberGPer100g: 0,
		pricePerG: 10.9,
		available: true,
		displayOrder: 1
	},
	{
		name: 'Olive Oil Balsamic',
		category: 'dressing',
		caloriesPer100g: 415,
		proteinGPer100g: 0,
		carbsGPer100g: 8.5,
		fatGPer100g: 45.5,
		fiberGPer100g: 0,
		pricePerG: 45,
		available: true,
		displayOrder: 2
	},
	{
		name: 'Honey Mustard',
		category: 'dressing',
		caloriesPer100g: 260,
		proteinGPer100g: 2,
		carbsGPer100g: 32,
		fatGPer100g: 14,
		fiberGPer100g: 0.5,
		pricePerG: 15,
		available: true,
		displayOrder: 3
	}
];

// ---------------------------------------------------------------------------
// Menu definitions (source of truth: seed.ts)
// ---------------------------------------------------------------------------

const menuData = [
	{
		nameEs: 'Bueno, bonito y al gramo',
		nameEn: 'Good, Pretty & Precise',
		descriptionEs:
			'Arroz blanco con pollo a la plancha, zanahoria rallada, aguacate, maíz dulce y pepino fresco, acompañado de salsa teriyaki.',
		descriptionEn:
			'White rice with grilled chicken, grated carrot, avocado, sweet corn and fresh cucumber, with teriyaki sauce.',
		bowlSize: 450,
		active: true,
		displayOrder: 1,
		items: [
			{ ingredientName: 'Rice', quantityGrams: 150, sequenceOrder: 1 },
			{ ingredientName: 'Chicken', quantityGrams: 100, sequenceOrder: 2 },
			{ ingredientName: 'Carrot', quantityGrams: 60, sequenceOrder: 3 },
			{ ingredientName: 'Avocado', quantityGrams: 40, sequenceOrder: 4 },
			{ ingredientName: 'Corn', quantityGrams: 30, sequenceOrder: 5 },
			{ ingredientName: 'Cucumber', quantityGrams: 30, sequenceOrder: 6 },
			{ ingredientName: 'Teriyaki', quantityGrams: 25, sequenceOrder: 7 }
		]
	},
	{
		nameEs: 'Hoy empiezo la dieta',
		nameEn: 'Diet Starts Today',
		descriptionEs:
			'Bajo en calorías. Quinua con pollo a la plancha, tomate cherry, mango y vegetales frescos, con vinagreta de aceite de oliva y balsámico.',
		descriptionEn:
			'Low calorie. Quinoa with grilled chicken, cherry tomatoes, mango and fresh vegetables, with olive oil and balsamic vinaigrette.',
		bowlSize: 450,
		active: true,
		displayOrder: 2,
		items: [
			{ ingredientName: 'Quinoa', quantityGrams: 100, sequenceOrder: 1 },
			{ ingredientName: 'Chicken', quantityGrams: 120, sequenceOrder: 2 },
			{ ingredientName: 'Cherry Tomatoes', quantityGrams: 40, sequenceOrder: 3 },
			{ ingredientName: 'Mango', quantityGrams: 40, sequenceOrder: 4 },
			{ ingredientName: 'Carrot', quantityGrams: 40, sequenceOrder: 5 },
			{ ingredientName: 'Avocado', quantityGrams: 40, sequenceOrder: 6 },
			{ ingredientName: 'Cucumber', quantityGrams: 40, sequenceOrder: 7 },
			{ ingredientName: 'Olive Oil Balsamic', quantityGrams: 25, sequenceOrder: 8 }
		]
	},
	{
		nameEs: 'Alto en proteína',
		nameEn: 'High Protein',
		descriptionEs:
			'Arroz blanco con pollo a la plancha, tomate cherry, mango y trocitos de cebolla roja, acompañado de aguacate, maíz, mozzarella y maní crocante, con salsa teriyaki.',
		descriptionEn:
			'White rice with grilled chicken, cherry tomatoes, mango and red onion, avocado, corn, mozzarella and crunchy peanuts, with teriyaki sauce.',
		bowlSize: 450,
		active: true,
		displayOrder: 3,
		items: [
			{ ingredientName: 'Rice', quantityGrams: 70, sequenceOrder: 1 },
			{ ingredientName: 'Chicken', quantityGrams: 180, sequenceOrder: 2 },
			{ ingredientName: 'Cherry Tomatoes', quantityGrams: 30, sequenceOrder: 3 },
			{ ingredientName: 'Mango', quantityGrams: 30, sequenceOrder: 4 },
			{ ingredientName: 'Onion', quantityGrams: 20, sequenceOrder: 5 },
			{ ingredientName: 'Avocado', quantityGrams: 30, sequenceOrder: 6 },
			{ ingredientName: 'Corn', quantityGrams: 30, sequenceOrder: 7 },
			{ ingredientName: 'Mozzarella', quantityGrams: 20, sequenceOrder: 8 },
			{ ingredientName: 'Peanuts', quantityGrams: 10, sequenceOrder: 9 },
			{ ingredientName: 'Teriyaki', quantityGrams: 25, sequenceOrder: 10 }
		]
	},
	{
		nameEs: 'Verde y sabroso',
		nameEn: 'Green & Tasty',
		descriptionEs:
			'100% vegetariano. Arroz blanco, champiñones salteados, tomate cherry y mango, zanahoria rallada, aguacate y pepino, con aderezo de miel y mostaza.',
		descriptionEn:
			'100% vegetarian. White rice, sautéed mushrooms, cherry tomatoes and mango, grated carrot, avocado and cucumber, with honey mustard dressing.',
		bowlSize: 450,
		active: true,
		displayOrder: 4,
		items: [
			{ ingredientName: 'Rice', quantityGrams: 100, sequenceOrder: 1 },
			{ ingredientName: 'Mushroom', quantityGrams: 120, sequenceOrder: 2 },
			{ ingredientName: 'Cherry Tomatoes', quantityGrams: 40, sequenceOrder: 3 },
			{ ingredientName: 'Mango', quantityGrams: 40, sequenceOrder: 4 },
			{ ingredientName: 'Carrot', quantityGrams: 40, sequenceOrder: 5 },
			{ ingredientName: 'Avocado', quantityGrams: 40, sequenceOrder: 6 },
			{ ingredientName: 'Cucumber', quantityGrams: 40, sequenceOrder: 7 },
			{ ingredientName: 'Honey Mustard', quantityGrams: 25, sequenceOrder: 8 }
		]
	},
	{
		nameEs: 'Premium de Salmón',
		nameEn: 'Salmon Premium',
		descriptionEs:
			'Quinua con salmón a la plancha, champiñones salteados, tomate cherry y trocitos de mango, acompañado de zanahoria, aguacate y cebollín, con toque de vinagreta de balsámico.',
		descriptionEn:
			'Quinoa with grilled salmon, sautéed mushrooms, cherry tomatoes and mango, with carrot, avocado and chive, finished with a touch of balsamic vinaigrette.',
		bowlSize: 450,
		active: true,
		displayOrder: 5,
		items: [
			{ ingredientName: 'Quinoa', quantityGrams: 80, sequenceOrder: 1 },
			{ ingredientName: 'Mushroom', quantityGrams: 40, sequenceOrder: 2 },
			{ ingredientName: 'Salmon', quantityGrams: 100, sequenceOrder: 3 },
			{ ingredientName: 'Cherry Tomatoes', quantityGrams: 50, sequenceOrder: 4 },
			{ ingredientName: 'Mango', quantityGrams: 50, sequenceOrder: 5 },
			{ ingredientName: 'Carrot', quantityGrams: 40, sequenceOrder: 6 },
			{ ingredientName: 'Avocado', quantityGrams: 50, sequenceOrder: 7 },
			{ ingredientName: 'Green Onion', quantityGrams: 10, sequenceOrder: 8 },
			{ ingredientName: 'Olive Oil Balsamic', quantityGrams: 25, sequenceOrder: 9 }
		]
	}
];

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
	console.log('Starting safe menu seed (no data will be deleted)...');
	console.log();

	// -------------------------------------------------------------------------
	// Step 1: Fetch existing ingredients by name
	// -------------------------------------------------------------------------
	const existingIngredients = await prisma.ingredient.findMany({
		select: { id: true, name: true }
	});
	const existingIngredientNames = new Set(existingIngredients.map((i) => i.name));

	console.log(`Found ${existingIngredients.length} existing ingredient(s) in database.`);

	// -------------------------------------------------------------------------
	// Step 2: Create only missing ingredients
	// -------------------------------------------------------------------------
	const missingIngredients = ingredientData.filter((i) => !existingIngredientNames.has(i.name));

	if (missingIngredients.length === 0) {
		console.log('Ingredients: all already present — skipping creation.');
	} else {
		console.log(
			`Ingredients: creating ${missingIngredients.length} missing — ${missingIngredients.map((i) => i.name).join(', ')}`
		);
		// Reset the sequence to avoid conflicts with existing IDs
		await prisma.$executeRaw`SELECT setval(pg_get_serial_sequence('ingredients', 'id'), COALESCE((SELECT MAX(id) FROM ingredients), 0))`;
		for (const ing of missingIngredients) {
			await prisma.ingredient.create({ data: ing });
		}
		console.log(`Ingredients: created ${missingIngredients.length} new ingredient(s).`);
	}

	// -------------------------------------------------------------------------
	// Step 3: Build name→id lookup from ALL ingredients (existing + new)
	// -------------------------------------------------------------------------
	const allIngredients = await prisma.ingredient.findMany({ select: { id: true, name: true } });
	const byName: Record<string, number> = {};
	allIngredients.forEach((i) => {
		byName[i.name] = i.id;
	});

	console.log(`Ingredient lookup map built with ${allIngredients.length} entries.`);
	console.log();

	// -------------------------------------------------------------------------
	// Step 4: Fetch existing menus by nameEs
	// -------------------------------------------------------------------------
	const existingMenus = await prisma.menu.findMany({ select: { id: true, nameEs: true } });
	const existingMenuNames = new Set(existingMenus.map((m) => m.nameEs));

	console.log(`Found ${existingMenus.length} existing menu(s) in database.`);

	// -------------------------------------------------------------------------
	// Step 5: Create only missing menus + their MenuIngredient records
	// -------------------------------------------------------------------------
	const missingMenus = menuData.filter((m) => !existingMenuNames.has(m.nameEs));

	if (missingMenus.length === 0) {
		console.log('Menus: all 5 already present — skipping creation.');
	} else {
		console.log(`Menus: creating ${missingMenus.length} missing menu(s)...`);

		for (const menuDef of missingMenus) {
			// Validate that all required ingredients exist in the lookup map
			const missingIngredientRefs = menuDef.items.filter(
				(item) => byName[item.ingredientName] === undefined
			);
			if (missingIngredientRefs.length > 0) {
				const names = missingIngredientRefs.map((i) => i.ingredientName).join(', ');
				throw new Error(
					`Menu "${menuDef.nameEs}" references ingredient(s) not found in database: ${names}`
				);
			}

			const menu = await prisma.menu.create({
				data: {
					nameEs: menuDef.nameEs,
					nameEn: menuDef.nameEn,
					descriptionEs: menuDef.descriptionEs,
					descriptionEn: menuDef.descriptionEn,
					bowlSize: menuDef.bowlSize,
					active: menuDef.active,
					displayOrder: menuDef.displayOrder
				}
			});

			await prisma.menuIngredient.createMany({
				data: menuDef.items.map((item) => ({
					menuId: menu.id,
					ingredientId: byName[item.ingredientName],
					quantityGrams: item.quantityGrams,
					sequenceOrder: item.sequenceOrder
				}))
			});

			console.log(`  Created menu "${menuDef.nameEs}" with ${menuDef.items.length} ingredient(s).`);
		}

		console.log(`Menus: created ${missingMenus.length} new menu(s).`);
	}

	console.log();
	console.log('Safe menu seed completed successfully.');
}

main()
	.catch((e) => {
		console.error('Error during safe menu seed:', e);
		process.exit(1);
	})
	.finally(async () => {
		await prisma.$disconnect();
	});
