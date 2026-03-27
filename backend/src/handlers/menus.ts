/**
 * Menus API Handler
 * GET /api/menus - Get all active menus with their ingredients
 */

import type { APIGatewayProxyHandler } from 'aws-lambda';
import prisma from '../lib/db.js';
import { success, serverError } from '../lib/response.js';

/**
 * GET /api/menus
 * Returns all active menus with their ingredients and nutritional data
 */
export const getMenus: APIGatewayProxyHandler = async () => {
	try {
		const menus = await prisma.menu.findMany({
			where: { active: true },
			orderBy: [{ displayOrder: 'asc' }],
			include: {
				ingredients: {
					include: { ingredient: true },
					orderBy: { sequenceOrder: 'asc' }
				}
			}
		});

		const serializedMenus = menus.map((menu) => ({
			id: menu.id,
			nameEs: menu.nameEs,
			nameEn: menu.nameEn,
			descriptionEs: menu.descriptionEs,
			descriptionEn: menu.descriptionEn,
			bowlSize: menu.bowlSize,
			active: menu.active,
			displayOrder: menu.displayOrder,
			ingredients: menu.ingredients.map((mi) => ({
				ingredientId: mi.ingredientId,
				ingredientName: mi.ingredient.name,
				quantityGrams: mi.quantityGrams.toNumber(),
				sequenceOrder: mi.sequenceOrder,
				caloriesPer100g: mi.ingredient.caloriesPer100g.toNumber(),
				proteinGPer100g: mi.ingredient.proteinGPer100g.toNumber(),
				carbsGPer100g: mi.ingredient.carbsGPer100g.toNumber(),
				fatGPer100g: mi.ingredient.fatGPer100g.toNumber(),
				fiberGPer100g: mi.ingredient.fiberGPer100g?.toNumber() ?? null,
				pricePerG: mi.ingredient.pricePerG.toNumber()
			}))
		}));

		return success({ menus: serializedMenus });
	} catch (error) {
		console.error('Error fetching menus:', error);
		return serverError('Failed to fetch menus');
	}
};
