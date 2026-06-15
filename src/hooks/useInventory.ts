import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useHousehold } from '@/hooks/useHousehold'
import type { InventoryItemWithCategory, L1Category } from '@/types/database'

export function useInventory(l1: L1Category) {
  const { household } = useHousehold()
  const [items, setItems] = useState<InventoryItemWithCategory[]>([])
  const [loading, setLoading] = useState(true)

  const fetchItems = useCallback(async (opts?: { silent?: boolean }) => {
    if (!household) {
      setItems([])
      if (!opts?.silent) setLoading(false)
      return
    }

    if (!opts?.silent) setLoading(true)
    const { data, error } = await supabase
      .from('inventory_items')
      .select('*')
      .eq('household_id', household.id)
      .eq('l1', l1)
      .order('name')

    if (!error && data) {
      setItems(data as InventoryItemWithCategory[])
    }
    if (!opts?.silent) setLoading(false)
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
          void fetchItems({ silent: true })
        },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [household, l1, fetchItems])

  const findDuplicate = useCallback(
    (name: string) =>
      items.find((i) => i.name.toLowerCase() === name.toLowerCase()),
    [items],
  )

  const addItem = useCallback(
    async (
      item: {
        name: string
        quantity: number
        unit: string
        category_id: string | null
        low_stock_threshold: number | null
        notes?: string
      },
      opts?: { mergeIfDuplicate?: boolean },
    ) => {
      if (!household) return { error: 'No household' as const, duplicate: undefined }

      const existing = findDuplicate(item.name)
      const shouldMerge = opts?.mergeIfDuplicate !== false

      if (existing && !shouldMerge) {
        return { error: null, duplicate: existing }
      }

      const { error } = await supabase.from('inventory_items').insert({
        household_id: household.id,
        l1,
        ...item,
      })

      if (error) return { error: error.message, duplicate: undefined }

      void fetchItems({ silent: true })
      return { error: null, duplicate: undefined }
    },
    [household, l1, findDuplicate, fetchItems],
  )

  const updateExistingItem = useCallback(
    async (
      id: string,
      updates: {
        quantity?: number
        unit?: string
        low_stock_threshold?: number | null
        notes?: string
      },
      mode: 'add' | 'replace',
    ) => {
      const existing = items.find((i) => i.id === id)
      if (!existing) return { error: 'Item not found' }

      const quantity =
        mode === 'add'
          ? Number(existing.quantity) + (updates.quantity ?? 0)
          : (updates.quantity ?? Number(existing.quantity))

      setItems((prev) =>
        prev.map((i) =>
          i.id === id
            ? {
                ...i,
                quantity,
                ...(updates.unit ? { unit: updates.unit } : {}),
                ...(updates.low_stock_threshold !== undefined
                  ? { low_stock_threshold: updates.low_stock_threshold }
                  : {}),
                ...(updates.notes !== undefined ? { notes: updates.notes } : {}),
              }
            : i,
        ),
      )

      const { error } = await supabase
        .from('inventory_items')
        .update({
          quantity,
          ...(updates.unit ? { unit: updates.unit } : {}),
          ...(updates.low_stock_threshold !== undefined
            ? { low_stock_threshold: updates.low_stock_threshold }
            : {}),
          ...(updates.notes !== undefined ? { notes: updates.notes } : {}),
        })
        .eq('id', id)

      if (error) {
        void fetchItems({ silent: true })
        return { error: error.message }
      }
      return { error: null }
    },
    [items, fetchItems],
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
      setItems((prev) =>
        prev.map((i) => (i.id === id ? { ...i, ...updates } : i)),
      )

      const { error } = await supabase.from('inventory_items').update(updates).eq('id', id)

      if (error) {
        void fetchItems({ silent: true })
        return { error: error.message }
      }
      return { error: null }
    },
    [fetchItems],
  )

  const deleteItem = useCallback(
    async (id: string) => {
      setItems((prev) => prev.filter((i) => i.id !== id))
      const { error } = await supabase.from('inventory_items').delete().eq('id', id)
      if (error) {
        void fetchItems({ silent: true })
        return { error: error.message }
      }
      return { error: null }
    },
    [fetchItems],
  )

  return {
    items,
    loading,
    addItem,
    updateExistingItem,
    findDuplicate,
    updateItem,
    deleteItem,
    refresh: fetchItems,
  }
}
