import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { useHousehold } from '@/hooks/useHousehold'
import type { L1Category, ShoppingListL1, ShoppingListItem } from '@/types/database'

export type ShoppingListItemWithMeta = ShoppingListItem

export function useShoppingList() {
  const { user } = useAuth()
  const { household } = useHousehold()
  const [items, setItems] = useState<ShoppingListItemWithMeta[]>([])
  const [loading, setLoading] = useState(true)

  const fetchItems = useCallback(async () => {
    if (!household) {
      setItems([])
      setLoading(false)
      return
    }

    setLoading(true)
    const { data, error } = await supabase
      .from('shopping_list_items')
      .select('*')
      .eq('household_id', household.id)
      .order('l1')
      .order('name')

    if (!error && data) setItems(data as ShoppingListItemWithMeta[])
    setLoading(false)
  }, [household])

  useEffect(() => {
    void fetchItems()
  }, [fetchItems])

  useEffect(() => {
    if (!household) return

    const channel = supabase
      .channel(`shopping-${household.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'shopping_list_items',
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
  }, [household, fetchItems])

  const addToList = useCallback(
    async (item: {
      name: string
      quantity: number
      unit: string
      l1: ShoppingListL1
      inventory_item_id?: string | null
      category_id?: string | null
    }) => {
      if (!household) return { error: 'No household' }

      const existing = items.find(
        (i) =>
          i.name.toLowerCase() === item.name.toLowerCase() &&
          i.l1 === item.l1 &&
          (item.inventory_item_id ? i.inventory_item_id === item.inventory_item_id : true),
      )

      if (existing) {
        const { error } = await supabase
          .from('shopping_list_items')
          .update({ quantity: Number(existing.quantity) + item.quantity })
          .eq('id', existing.id)
        if (!error) await fetchItems()
        return { error: error?.message ?? null }
      }

      const { error } = await supabase.from('shopping_list_items').insert({
        household_id: household.id,
        added_by: user?.id ?? null,
        ...item,
      })

      if (!error) await fetchItems()
      return { error: error?.message ?? null }
    },
    [household, user, items, fetchItems],
  )

  const removeFromList = useCallback(
    async (id: string) => {
      const { error } = await supabase.from('shopping_list_items').delete().eq('id', id)
      if (!error) await fetchItems()
      return { error: error?.message ?? null }
    },
    [fetchItems],
  )

  const updateListQuantity = useCallback(
    async (id: string, quantity: number) => {
      if (quantity <= 0) {
        return removeFromList(id)
      }

      const { error } = await supabase
        .from('shopping_list_items')
        .update({ quantity })
        .eq('id', id)

      if (!error) await fetchItems()
      return { error: error?.message ?? null }
    },
    [fetchItems, removeFromList],
  )

  const logActivity = useCallback(
    async (message: string) => {
      if (!household) return
      await supabase.from('activity_log').insert({
        household_id: household.id,
        user_id: user?.id ?? null,
        message,
      })
    },
    [household, user],
  )

  const completePurchase = useCallback(
    async (
      listItem: ShoppingListItem,
      purchasedQuantity: number,
      createInventoryIfMissing: boolean,
    ) => {
      if (!household) return { error: 'No household' }

      const isGeneral = listItem.l1 === 'general'

      if (!isGeneral) {
        if (listItem.inventory_item_id) {
          const { data: inv } = await supabase
            .from('inventory_items')
            .select('quantity')
            .eq('id', listItem.inventory_item_id)
            .single()

          if (inv) {
            await supabase
              .from('inventory_items')
              .update({ quantity: Number(inv.quantity) + purchasedQuantity })
              .eq('id', listItem.inventory_item_id)
          }
        } else if (createInventoryIfMissing) {
          await supabase.from('inventory_items').insert({
            household_id: household.id,
            l1: listItem.l1 as L1Category,
            name: listItem.name,
            quantity: purchasedQuantity,
            unit: listItem.unit,
            category_id: listItem.category_id,
          })
        }
      }

      await supabase.from('shopping_list_items').delete().eq('id', listItem.id)

      const displayName =
        (user?.user_metadata?.display_name as string | undefined) ?? 'Someone'
      await logActivity(
        isGeneral
          ? `${displayName} checked off ${listItem.name}`
          : `${displayName} bought ${purchasedQuantity} ${listItem.unit} of ${listItem.name}`,
      )

      await fetchItems()
      return { error: null }
    },
    [household, user, fetchItems, logActivity],
  )

  return {
    items,
    loading,
    addToList,
    removeFromList,
    updateListQuantity,
    completePurchase,
    refresh: fetchItems,
  }
}
