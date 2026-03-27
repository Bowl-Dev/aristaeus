/**
 * Aristaeus Database Seed Script
 * Seeds the database with ingredients from frontend mock data
 * Data sourced from Bowls Request Form.xlsx - "Precios en bowl" sheet
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

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
	const ingredients = await prisma.ingredient.createMany({
		data: [
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
		]
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
