export const UNITS = [
  'each',
  'g',
  'kg',
  'ml',
  'L',
  'cup',
  'tbsp',
  'tsp',
  'oz',
  'lb',
  'pack',
  'bottle',
  'can',
] as const

export type Unit = (typeof UNITS)[number]

export const DEFAULT_PANTRY_CATEGORIES = [
  'Produce',
  'Dairy',
  'Meat & Fish',
  'Baking',
  'Canned',
  'Spices',
  'Frozen',
  'Snacks',
  'Beverages',
] as const

export const DEFAULT_SUPPLY_CATEGORIES = [
  'Cleaning',
  'Laundry',
  'Bathroom',
  'Paper Products',
  'Kitchen Supplies',
  'Personal Care',
] as const

export type L1Category = 'pantry' | 'supply'

export const RECIPE_L1_CATEGORIES = [
  { value: 'starters', label: 'Starters' },
  { value: 'entrees', label: 'Entrees' },
  { value: 'desserts', label: 'Desserts' },
] as const

export type RecipeL1Category = (typeof RECIPE_L1_CATEGORIES)[number]['value']

export type SortOption =
  | 'name-asc'
  | 'name-desc'
  | 'quantity-asc'
  | 'quantity-desc'
  | 'updated'
