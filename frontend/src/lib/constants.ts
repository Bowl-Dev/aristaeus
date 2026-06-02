// Default city/department/neighborhood applied to every order until the
// delivery form captures structured location fields. Today the customer's
// real address lives entirely in the free-form `streetAddress` field; the
// structured fields below are placeholders so backend Zod validation passes.
// When the form grows neighborhood/city pickers, replace usages of this
// constant with the form values.
export const DEFAULT_DELIVERY_LOCALE = {
	neighborhood: 'Bogotá',
	city: 'Bogotá',
	department: 'Bogotá D.C.'
} as const;

// Flat surcharge (COP) added to a bowl when the customer opts to include
// cutlery. Mirrors the legacy app's +$300 cutlery option.
export const CUTLERY_PRICE = 300;
