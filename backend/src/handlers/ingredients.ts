/**
 * Ingredients API Handler
 * GET /api/ingredients - Get all available ingredients
 */

import type { APIGatewayProxyHandler } from 'aws-lambda';
import prisma from '../lib/db.js';
import { success, serverError } from '../lib/response.js';

/**
 * GET /api/ingredients
 * Returns all available ingredients with nutritional data
 */
export const getIngredients: APIGatewayProxyHandler = async () => {
	try {
		const ingredients = await prisma.ingredient.findMany({
			where: {
				available: true
			},
			orderBy: [{ category: 'asc' }, { displayOrder: 'asc' }, { name: 'asc' }],
			select: {
				id: true,
				name: true,
				category: true,
				caloriesPer100g: true,
				proteinGPer100g: true,
				carbsGPer100g: true,
				fatGPer100g: true,
				fiberGPer100g: true,
				available: true,
				displayOrder: true,
				pricePerG: true
			}
		});

		// Convert Decimal to number for JSON serialization
		const serializedIngredients = ingredients.map((ing) => ({
			id: ing.id,
			name: ing.name,
			category: ing.category,
			caloriesPer100g: ing.caloriesPer100g.toNumber(),
			proteinGPer100g: ing.proteinGPer100g.toNumber(),
			carbsGPer100g: ing.carbsGPer100g.toNumber(),
			fatGPer100g: ing.fatGPer100g.toNumber(),
			fiberGPer100g: ing.fiberGPer100g?.toNumber() ?? null,
			available: ing.available,
			displayOrder: ing.displayOrder,
			pricePerG: ing.pricePerG.toNumber()
		}));

		return success({ ingredients: serializedIngredients });
	} catch (error) {
		console.error('Error fetching ingredients:', error);
		return serverError('Failed to fetch ingredients');
	}
};
