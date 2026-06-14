import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useHousehold } from '@/hooks/useHousehold'
import type { InventoryItemWithCategory, L1Category } from '@/types/database'

export function useInventory(l1: L1Category) {
  const { household } = useHousehold()
  const [items, setItems] = useState<InventoryItemWithCategory[]>([])
  const [loading, setLoading] = useState(true)

  const fetchItems = useCallback(async () => {
    if (!household) {
      setItems([])
      setLoading(false)
      return
    }

    setLoading(true)
    const { data, error } = await supabase
      .from('inventory_items')
      .select('*, categories(id, name)')
      .eq('household_id', household.id)
      .eq('l1', l1)
      .order('name')

    if (!error && data) {
      setItems(data as InventoryItemWithCategory[])
    }
    setLoading(false)
  }, [household, l1])

  useEffect(() => {
    void fetchItems()
  }, [fetchItems])

  useEffect(() => {
    if (!household) return

    const channel = supabase
      .channel(`inventory-${household.id}-${l1}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'inventory_items',
          filter: `household_id=eq.${household.id}`,
        },
        () => {
          void fetchItems()
        },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [household, l1, fetchItems])

  const addItem = useCallback(
    async (item: {
      name: string
      quantity: number
      unit: string
      category_id: string | null
      low_stock_threshold: number | null
      notes?: string
    }) => {
      if (!household) return { error: 'No household' }

      const { error } = await supabase.from('inventory_items').insert({
        household_id: household.id,
        l1,
        ...item,
      })

      if (!error) await fetchItems()
      return { error: error?.message ?? null }
    },
    [household, l1, fetchItems],
  )

  const updateItem = useCallback(
    async (
      id: string,
      updates: Partial<{
        name: string
        quantity: number
        unit: string
        category_id: string | null
        low_stock_threshold: number | null
        notes: string | null
        snoozed_until: string | null
      }>,
    ) => {
      const { error } = await supabase.from('inventory_items').update(updates).eq('id', id)
      if (!error) await fetchItems()
      return { error: error?.message ?? null }
    },
    [fetchItems],
  )

  const deleteItem = useCallback(
    async (id: string) => {
      const { error } = await supabase.from('inventory_items').delete().eq('id', id)
      if (!error) await fetchItems()
      return { error: error?.message ?? null }
    },
    [fetchItems],
  )

  return { items, loading, addItem, updateItem, deleteItem, refresh: fetchItems }
}
