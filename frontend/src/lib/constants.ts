// Display order for ingredient categories, shared by the customer Builder and
// the kitchen/admin order view so the two surfaces can't drift apart. This is
// presentation only — robot assembly uses each item's `sequenceOrder`.
export const CATEGORY_ORDER = ['base', 'protein', 'vegetable', 'topping', 'dressing'];
