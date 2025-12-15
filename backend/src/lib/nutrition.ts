/**
 * Nutritional Calculation Utilities
 * Server-side validation and calculation (must match frontend logic)
 */

import type { Ingredient } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

export interface NutritionalSummary {
  totalCalories: number;
  totalProteinG: number;
  totalCarbsG: number;
  totalFatG: number;
  totalFiberG: number;
  totalWeightG: number;
}

export interface OrderItemInput {
  ingredientId: number;
  quantityGrams: number;
}

/**
 * Calculate nutritional summary for a list of order items
 * This MUST match the frontend calculation exactly
 */
export function calculateNutrition(
  items: OrderItemInput[],
  ingredients: Map<number, Ingredient>
): NutritionalSummary {
  const totals: NutritionalSummary = {
    totalCalories: 0,
    totalProteinG: 0,
    totalCarbsG: 0,
    totalFatG: 0,
    totalFiberG: 0,
    totalWeightG: 0,
  };

  for (const item of items) {
    const ingredient = ingredients.get(item.ingredientId);
    if (!ingredient) continue;

    const multiplier = item.quantityGrams / 100;

    totals.totalCalories += toNumber(ingredient.caloriesPer100g) * multiplier;
    totals.totalProteinG += toNumber(ingredient.proteinGPer100g) * multiplier;
    totals.totalCarbsG += toNumber(ingredient.carbsGPer100g) * multiplier;
    totals.totalFatG += toNumber(ingredient.fatGPer100g) * multiplier;
    totals.totalFiberG += toNumber(ingredient.fiberGPer100g ?? 0) * multiplier;
    totals.totalWeightG += item.quantityGrams;
  }

  // Round to 2 decimal places
  return {
    totalCalories: round(totals.totalCalories),
    totalProteinG: round(totals.totalProteinG),
    totalCarbsG: round(totals.totalCarbsG),
    totalFatG: round(totals.totalFatG),
    totalFiberG: round(totals.totalFiberG),
    totalWeightG: round(totals.totalWeightG),
  };
}

function toNumber(value: Decimal | number | null): number {
  if (value === null) return 0;
  if (typeof value === 'number') return value;
  return value.toNumber();
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
