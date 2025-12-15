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
        available: true,
        displayOrder: 1,
      },
      {
        name: 'Salmon',
        category: 'protein',
        caloriesPer100g: 208,
        proteinGPer100g: 20,
        carbsGPer100g: 0,
        fatGPer100g: 13,
        fiberGPer100g: 0,
        available: true,
        displayOrder: 2,
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
        available: true,
        displayOrder: 1,
      },
      {
        name: 'Quinoa',
        category: 'base',
        caloriesPer100g: 120,
        proteinGPer100g: 4.3,
        carbsGPer100g: 21,
        fatGPer100g: 1.8,
        fiberGPer100g: 1.3,
        available: true,
        displayOrder: 2,
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
        available: true,
        displayOrder: 1,
      },
      {
        name: 'Mango',
        category: 'vegetable',
        caloriesPer100g: 60,
        proteinGPer100g: 0.5,
        carbsGPer100g: 15,
        fatGPer100g: 0.2,
        fiberGPer100g: 1.7,
        available: true,
        displayOrder: 2,
      },
      {
        name: 'Carrot',
        category: 'vegetable',
        caloriesPer100g: 41,
        proteinGPer100g: 0.9,
        carbsGPer100g: 9.5,
        fatGPer100g: 0.2,
        fiberGPer100g: 2.8,
        available: true,
        displayOrder: 3,
      },
      {
        name: 'Onion',
        category: 'vegetable',
        caloriesPer100g: 40,
        proteinGPer100g: 1.1,
        carbsGPer100g: 9.3,
        fatGPer100g: 0.1,
        fiberGPer100g: 1.0,
        available: true,
        displayOrder: 4,
      },
      {
        name: 'Avocado',
        category: 'vegetable',
        caloriesPer100g: 160,
        proteinGPer100g: 2.0,
        carbsGPer100g: 0.9,
        fatGPer100g: 15,
        fiberGPer100g: 6.7,
        available: true,
        displayOrder: 5,
      },
      {
        name: 'Corn',
        category: 'vegetable',
        caloriesPer100g: 96,
        proteinGPer100g: 3.2,
        carbsGPer100g: 21,
        fatGPer100g: 1.5,
        fiberGPer100g: 2.6,
        available: true,
        displayOrder: 6,
      },
      {
        name: 'Cucumber',
        category: 'vegetable',
        caloriesPer100g: 16,
        proteinGPer100g: 0.7,
        carbsGPer100g: 3.6,
        fatGPer100g: 0.1,
        fiberGPer100g: 0.5,
        available: true,
        displayOrder: 7,
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
        available: true,
        displayOrder: 1,
      },
      {
        name: 'Green Onion',
        category: 'topping',
        caloriesPer100g: 32,
        proteinGPer100g: 0.9,
        carbsGPer100g: 7.4,
        fatGPer100g: 0.05,
        fiberGPer100g: 0.8,
        available: true,
        displayOrder: 2,
      },
      {
        name: 'Peanuts',
        category: 'topping',
        caloriesPer100g: 600,
        proteinGPer100g: 25,
        carbsGPer100g: 16,
        fatGPer100g: 52,
        fiberGPer100g: 10,
        available: true,
        displayOrder: 3,
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
        available: true,
        displayOrder: 1,
      },
      {
        name: 'Olive Oil Balsamic',
        category: 'dressing',
        caloriesPer100g: 415,
        proteinGPer100g: 0,
        carbsGPer100g: 8.5,
        fatGPer100g: 45.5,
        fiberGPer100g: 0,
        available: true,
        displayOrder: 2,
      },
    ],
  });

  console.log(`Created ${ingredients.count} ingredients`);

  // Seed test robot
  const robot = await prisma.robot.create({
    data: {
      name: 'Kitchen Robot 01',
      identifier: 'MOCK_ROBOT_001',
      status: 'online',
    },
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
