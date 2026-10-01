import type { Recipe } from '../types';
export interface ShoppingListState {
    recipeSlugs: string[];
    checked: Record<string, boolean>;
    quantities: Record<string, string>;
}
/** Treat browser storage as untrusted input, while retaining valid v1 data. */
export function normalizeShoppingState(value: unknown, recipes: Recipe[]): ShoppingListState {
    const empty: ShoppingListState = { recipeSlugs: [], checked: {}, quantities: {} };
    if (!value || typeof value !== 'object' || Array.isArray(value))
        return empty;
    const input = value as Record<string, unknown>;
    const recipeSlugs = Array.isArray(input.recipeSlugs)
        ? [...new Set(input.recipeSlugs.filter((slug): slug is string => typeof slug === 'string' && recipes.some((recipe) => recipe.slug === slug)))] : [];
    const validKeys = new Set(recipeSlugs.flatMap((slug) => recipes.find((recipe) => recipe.slug === slug)!.ingredients.map((_, i) => `${slug}:${i}`)));
    const entries = (field: unknown): [
        string,
        unknown
    ][] => field && typeof field === 'object' && !Array.isArray(field) ? Object.entries(field) : [];
    return {
        recipeSlugs,
        checked: Object.fromEntries(entries(input.checked).filter(([key, v]) => validKeys.has(key) && typeof v === 'boolean')) as Record<string, boolean>,
        quantities: Object.fromEntries(entries(input.quantities).filter(([key, v]) => validKeys.has(key) && typeof v === 'string' && v.length <= 100)) as Record<string, string>,
    };
}
/** Use the same effective quantities for the screen and clipboard. */
export function ingredientsWithQuantities(recipe: Recipe, quantities: Record<string, string>) {
    return recipe.ingredients.map((ingredient, index) => ({
        ...ingredient, quantity: quantities[`${recipe.slug}:${index}`] ?? ingredient.quantity,
    }));
}
