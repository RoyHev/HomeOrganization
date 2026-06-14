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

export type SortOption =
  | 'name-asc'
  | 'name-desc'
  | 'quantity-asc'
  | 'quantity-desc'
  | 'category'
  | 'updated'
