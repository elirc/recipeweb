export type Cuisine = 'filipino' | 'vietnamese' | 'thai' | 'spanish';

export type Category =
  | 'main'
  | 'noodles'
  | 'soup'
  | 'rice'
  | 'appetizer'
  | 'dessert';

export type Difficulty = 'easy' | 'medium' | 'hard';

export interface Ingredient {
  /** Optional ingredient group, e.g. "Marinade" or "Nuoc cham" */
  group: string | null;
  quantity: string;
  item: string;
}

export interface Recipe {
  slug: string;
  name: string;
  nativeName: string | null;
  cuisine: Cuisine;
  category: Category;
  description: string;
  sourceName: string;
  sourceUrl: string;
  servings: number | null;
  prepTime: string | null;
  cookTime: string | null;
  difficulty: Difficulty;
  ingredients: Ingredient[];
  tags: string[];
}

export const CATEGORY_LABELS: Record<Category, string> = {
  main: 'Mains',
  noodles: 'Noodles',
  soup: 'Soups',
  rice: 'Rice',
  appetizer: 'Appetizers',
  dessert: 'Desserts',
};

export const CUISINE_LABELS: Record<Cuisine, string> = {
  filipino: 'Filipino',
  vietnamese: 'Vietnamese',
  thai: 'Thai',
  spanish: 'Spanish',
};
