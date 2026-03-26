import type { BowlSize } from '$lib/types';

export interface MenuItem {
	id: string;
	titleKey: string;
	descriptionKey: string;
	bowlSize: BowlSize;
	items: { ingredientName: string; quantityGrams: number }[];
}

export const MENU_ITEMS: MenuItem[] = [
	{
		id: 'bueno-bonito-al-gramo',
		titleKey: 'home.menuItems.buenoBonitoAlGramo.title',
		descriptionKey: 'home.menuItems.buenoBonitoAlGramo.description',
		bowlSize: 450,
		items: [
			{ ingredientName: 'Rice', quantityGrams: 150 },
			{ ingredientName: 'Chicken', quantityGrams: 100 },
			{ ingredientName: 'Carrot', quantityGrams: 60 },
			{ ingredientName: 'Avocado', quantityGrams: 40 },
			{ ingredientName: 'Corn', quantityGrams: 30 },
			{ ingredientName: 'Cucumber', quantityGrams: 30 },
			{ ingredientName: 'Teriyaki', quantityGrams: 25 }
		]
	},
	{
		id: 'hoy-empiezo-la-dieta',
		titleKey: 'home.menuItems.hoyEmpiezoLaDieta.title',
		descriptionKey: 'home.menuItems.hoyEmpiezoLaDieta.description',
		bowlSize: 450,
		items: [
			{ ingredientName: 'Quinoa', quantityGrams: 100 },
			{ ingredientName: 'Chicken', quantityGrams: 120 },
			{ ingredientName: 'Cherry Tomatoes', quantityGrams: 40 },
			{ ingredientName: 'Mango', quantityGrams: 40 },
			{ ingredientName: 'Carrot', quantityGrams: 40 },
			{ ingredientName: 'Avocado', quantityGrams: 40 },
			{ ingredientName: 'Cucumber', quantityGrams: 40 },
			{ ingredientName: 'Olive Oil Balsamic', quantityGrams: 25 }
		]
	},
	{
		id: 'alto-en-proteina',
		titleKey: 'home.menuItems.altoEnProteina.title',
		descriptionKey: 'home.menuItems.altoEnProteina.description',
		bowlSize: 450,
		items: [
			{ ingredientName: 'Rice', quantityGrams: 70 },
			{ ingredientName: 'Chicken', quantityGrams: 180 },
			{ ingredientName: 'Cherry Tomatoes', quantityGrams: 30 },
			{ ingredientName: 'Mango', quantityGrams: 30 },
			{ ingredientName: 'Onion', quantityGrams: 20 },
			{ ingredientName: 'Avocado', quantityGrams: 30 },
			{ ingredientName: 'Corn', quantityGrams: 30 },
			{ ingredientName: 'Mozzarella', quantityGrams: 20 },
			{ ingredientName: 'Peanuts', quantityGrams: 10 },
			{ ingredientName: 'Teriyaki', quantityGrams: 25 }
		]
	},
	{
		id: 'verde-y-sabroso',
		titleKey: 'home.menuItems.verdeYSabroso.title',
		descriptionKey: 'home.menuItems.verdeYSabroso.description',
		bowlSize: 450,
		items: [
			{ ingredientName: 'Rice', quantityGrams: 100 },
			{ ingredientName: 'Mushroom', quantityGrams: 120 },
			{ ingredientName: 'Cherry Tomatoes', quantityGrams: 40 },
			{ ingredientName: 'Mango', quantityGrams: 40 },
			{ ingredientName: 'Carrot', quantityGrams: 40 },
			{ ingredientName: 'Avocado', quantityGrams: 40 },
			{ ingredientName: 'Cucumber', quantityGrams: 40 },
			{ ingredientName: 'Honey Mustard', quantityGrams: 25 }
		]
	},
	{
		id: 'premium-de-salmon',
		titleKey: 'home.menuItems.premiumDeSalmon.title',
		descriptionKey: 'home.menuItems.premiumDeSalmon.description',
		bowlSize: 450,
		items: [
			{ ingredientName: 'Quinoa', quantityGrams: 80 },
			{ ingredientName: 'Mushroom', quantityGrams: 40 },
			{ ingredientName: 'Salmon', quantityGrams: 100 },
			{ ingredientName: 'Cherry Tomatoes', quantityGrams: 50 },
			{ ingredientName: 'Mango', quantityGrams: 50 },
			{ ingredientName: 'Carrot', quantityGrams: 40 },
			{ ingredientName: 'Avocado', quantityGrams: 50 },
			{ ingredientName: 'Green Onion', quantityGrams: 10 },
			{ ingredientName: 'Olive Oil Balsamic', quantityGrams: 25 }
		]
	}
];
