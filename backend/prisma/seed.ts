/**
 * Aristaeus Database Seed Script
 * Seeds the database with ingredients from frontend mock data
 * Data sourced from Bowls Request Form.xlsx - "Precios en bowl" sheet
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// S3 bucket hosting product imagery (see ENG-68)
const ASSETS_BASE_URL = 'https://aristaeus-assets.s3.us-east-1.amazonaws.com';

/**
 * Convert an ingredient/menu name into a URL-safe slug matching the asset filenames.
 * Mirrors `frontend/src/lib/utils/slug.ts` but additionally strips accents so names
 * like "Salmón" → "salmon" line up with the files in `frontend/static/ingredients/`.
 */
function toSlug(name: string): string {
	return name
		.normalize('NFD')
		.replace(/[̀-ͯ]/g, '')
		.toLowerCase()
		.trim()
		.replace(/\s+/g, '-')
		.replace(/[^a-z0-9-]/g, '');
}

function ingredientImageUrl(englishName: string): string {
	return `${ASSETS_BASE_URL}/ingredients/${toSlug(englishName)}.jpg`;
}

// Canonical menu image filenames (see ENG-68 / ENG-62 for upload). Keyed by nameEs.
const MENU_IMAGE_FILES: Record<string, string> = {
	'Bueno, bonito y al gramo': 'bueno-bonito.png',
	'Hoy empiezo la dieta': 'hoy-dieta.png',
	'Alto en proteína': 'alto-proteina.png',
	'Verde y sabroso': 'verde-sabroso.png',
	'Premium de Salmón': 'premium-salmon.png'
};

function menuImageUrl(nameEs: string): string | null {
	const file = MENU_IMAGE_FILES[nameEs];
	return file ? `${ASSETS_BASE_URL}/menus/${file}` : null;
}

async function main() {
	console.log('Seeding database...');

	// Clear existing data
	await prisma.orderItem.deleteMany();
	await prisma.order.deleteMany();
	await prisma.robot.deleteMany();
	await prisma.menuIngredient.deleteMany();
	await prisma.menu.deleteMany();
	await prisma.ingredient.deleteMany();

	// Seed ingredients (matching frontend mock data)
	const ingredientSeedData = [
			// Proteins
			{
				name: 'Chicken',
				nameEs: 'Pollo',
				nameEn: 'Chicken',
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
				nameEs: 'Salmón',
				nameEn: 'Salmon',
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
				nameEs: 'Champiñón',
				nameEn: 'Mushroom',
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
				nameEs: 'Arroz',
				nameEn: 'Rice',
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
				nameEs: 'Quinoa',
				nameEn: 'Quinoa',
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
				nameEs: 'Tomates Cherry',
				nameEn: 'Cherry Tomatoes',
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
				nameEs: 'Mango',
				nameEn: 'Mango',
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
				nameEs: 'Zanahoria',
				nameEn: 'Carrot',
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
				nameEs: 'Cebolla',
				nameEn: 'Onion',
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
				nameEs: 'Aguacate',
				nameEn: 'Avocado',
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
				nameEs: 'Maíz',
				nameEn: 'Corn',
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
				nameEs: 'Pepino',
				nameEn: 'Cucumber',
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
				nameEs: 'Mozzarella',
				nameEn: 'Mozzarella',
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
				nameEs: 'Cebollín',
				nameEn: 'Green Onion',
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
				nameEs: 'Maní',
				nameEn: 'Peanuts',
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
				nameEs: 'Teriyaki',
				nameEn: 'Teriyaki',
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
				nameEs: 'Aceite de Oliva Balsámico',
				nameEn: 'Olive Oil Balsamic',
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
				nameEs: 'Miel Mostaza',
				nameEn: 'Honey Mustard',
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

	const ingredients = await prisma.ingredient.createMany({
		data: ingredientSeedData.map((ing) => ({
			...ing,
			imageUrl: ingredientImageUrl(ing.name)
		}))
	});

	console.log(`Created ${ingredients.count} ingredients`);

	// Fetch all ingredients to build a name->id lookup map
	const allIngredients = await prisma.ingredient.findMany({ select: { id: true, name: true } });
	const byName: Record<string, number> = {};
	allIngredients.forEach((i) => {
		byName[i.name] = i.id;
	});

	// Seed menus
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

	for (const menuDef of menuData) {
		const menu = await prisma.menu.create({
			data: {
				nameEs: menuDef.nameEs,
				nameEn: menuDef.nameEn,
				descriptionEs: menuDef.descriptionEs,
				descriptionEn: menuDef.descriptionEn,
				bowlSize: menuDef.bowlSize,
				active: menuDef.active,
				displayOrder: menuDef.displayOrder,
				imageUrl: menuImageUrl(menuDef.nameEs)
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
	}

	console.log(`Created ${menuData.length} menus`);

	// Seed test robot
	const robot = await prisma.robot.create({
		data: {
			name: 'Kitchen Robot 01',
			identifier: 'MOCK_ROBOT_001',
			status: 'online'
		}
	});

	console.log(`Created test robot: ${robot.name} (${robot.identifier})`);

	console.log('Database seeding completed!');
}

main()
	.catch((e) => {
		console.error('Error seeding database:', e);
		process.exit(1);
	})
	.finally(async () => {
		await prisma.$disconnect();
	});
