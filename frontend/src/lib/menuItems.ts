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
		id: 'teriyaki-chicken',
		titleKey: 'home.menuItems.teriyakiChicken.title',
		descriptionKey: 'home.menuItems.teriyakiChicken.description',
		bowlSize: 450,
		items: [
			{ ingredientName: 'Rice', quantityGrams: 150 },
			{ ingredientName: 'Chicken', quantityGrams: 100 },
			{ ingredientName: 'Avocado', quantityGrams: 50 },
			{ ingredientName: 'Cherry Tomatoes', quantityGrams: 50 },
			{ ingredientName: 'Corn', quantityGrams: 50 },
			{ ingredientName: 'Green Onion', quantityGrams: 25 },
			{ ingredientName: 'Teriyaki', quantityGrams: 25 }
		]
	},
	{
		id: 'salmon-quinoa',
		titleKey: 'home.menuItems.salmonQuinoa.title',
		descriptionKey: 'home.menuItems.salmonQuinoa.description',
		bowlSize: 600,
		items: [
			{ ingredientName: 'Quinoa', quantityGrams: 200 },
			{ ingredientName: 'Salmon', quantityGrams: 150 },
			{ ingredientName: 'Cucumber', quantityGrams: 80 },
			{ ingredientName: 'Avocado', quantityGrams: 70 },
			{ ingredientName: 'Cherry Tomatoes', quantityGrams: 50 },
			{ ingredientName: 'Green Onion', quantityGrams: 25 },
			{ ingredientName: 'Olive Oil Balsamic', quantityGrams: 25 }
		]
	},
	{
		id: 'mushroom-garden',
		titleKey: 'home.menuItems.mushroomGarden.title',
		descriptionKey: 'home.menuItems.mushroomGarden.description',
		bowlSize: 450,
		items: [
			{ ingredientName: 'Quinoa', quantityGrams: 150 },
			{ ingredientName: 'Mushroom', quantityGrams: 100 },
			{ ingredientName: 'Carrot', quantityGrams: 60 },
			{ ingredientName: 'Corn', quantityGrams: 60 },
			{ ingredientName: 'Cucumber', quantityGrams: 50 },
			{ ingredientName: 'Peanuts', quantityGrams: 30 }
		]
	},
	{
		id: 'classic-chicken',
		titleKey: 'home.menuItems.classicChicken.title',
		descriptionKey: 'home.menuItems.classicChicken.description',
		bowlSize: 250,
		items: [
			{ ingredientName: 'Rice', quantityGrams: 100 },
			{ ingredientName: 'Chicken', quantityGrams: 80 },
			{ ingredientName: 'Cherry Tomatoes', quantityGrams: 40 },
			{ ingredientName: 'Cucumber', quantityGrams: 30 }
		]
	}
];
