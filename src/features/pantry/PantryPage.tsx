import { InventoryPage } from '@/features/inventory/InventoryPage'

export function PantryPage() {
  return (
    <InventoryPage
      l1="pantry"
      title="Pantry"
      emptyDescription="Track food and beverages in your pantry. Add items to see stock levels and get low-stock alerts."
    />
  )
}
