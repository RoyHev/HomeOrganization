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

  const fetchItems = useCallback(async (opts?: { silent?: boolean }) => {
    if (!household) {
      setItems([])
      if (!opts?.silent) setLoading(false)
      return
    }

    if (!opts?.silent) setLoading(true)
    const { data, error } = await supabase
      .from('shopping_list_items')
      .select('*')
      .eq('household_id', household.id)
      .order('l1')
      .order('name')

    if (!error && data) setItems(data as ShoppingListItemWithMeta[])
    if (!opts?.silent) setLoading(false)
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
          void fetchItems({ silent: true })
        },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [household, fetchItems])

  const findDuplicate = useCallback(
    (item: {
      name: string
      l1: ShoppingListL1
      inventory_item_id?: string | null
    }) =>
      items.find(
        (i) =>
          i.name.toLowerCase() === item.name.toLowerCase() &&
          i.l1 === item.l1 &&
          (item.inventory_item_id ? i.inventory_item_id === item.inventory_item_id : true),
      ),
    [items],
  )

  const addToList = useCallback(
    async (
      item: {
        name: string
        quantity: number
        unit: string
        l1: ShoppingListL1
        inventory_item_id?: string | null
        category_id?: string | null
      },
      opts?: { mergeIfDuplicate?: boolean },
    ) => {
      if (!household) return { error: 'No household' as const, duplicate: undefined }

      const existing = findDuplicate(item)
      const shouldMerge = opts?.mergeIfDuplicate !== false

      if (existing && !shouldMerge) {
        return { error: null, duplicate: existing }
      }

      if (existing) {
        const newQty = Number(existing.quantity) + item.quantity
        setItems((prev) =>
          prev.map((i) => (i.id === existing.id ? { ...i, quantity: newQty } : i)),
        )
        const { error } = await supabase
          .from('shopping_list_items')
          .update({ quantity: newQty })
          .eq('id', existing.id)
        if (error) {
          void fetchItems({ silent: true })
          return { error: error.message, duplicate: undefined }
        }
        return { error: null, duplicate: undefined }
      }

      const optimistic: ShoppingListItemWithMeta = {
        id: `temp-${Date.now()}`,
        household_id: household.id,
        added_by: user?.id ?? null,
        created_at: new Date().toISOString(),
        category_id: item.category_id ?? null,
        inventory_item_id: item.inventory_item_id ?? null,
        ...item,
      }
      setItems((prev) => [...prev, optimistic])

      const { data, error } = await supabase
        .from('shopping_list_items')
        .insert({
          household_id: household.id,
          added_by: user?.id ?? null,
          ...item,
        })
        .select()
        .single()

      if (error) {
        void fetchItems({ silent: true })
        return { error: error.message, duplicate: undefined }
      }

      if (data) {
        setItems((prev) => prev.map((i) => (i.id === optimistic.id ? (data as ShoppingListItemWithMeta) : i)))
      }
      return { error: null, duplicate: undefined }
    },
    [household, user, findDuplicate, fetchItems],
  )

  const updateExistingItem = useCallback(
    async (
      id: string,
      updates: { quantity?: number; unit?: string },
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
            ? { ...i, quantity, ...(updates.unit ? { unit: updates.unit } : {}) }
            : i,
        ),
      )

      const { error } = await supabase
        .from('shopping_list_items')
        .update({
          quantity,
          ...(updates.unit ? { unit: updates.unit } : {}),
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

  const removeFromList = useCallback(
    async (id: string) => {
      setItems((prev) => prev.filter((i) => i.id !== id))
      const { error } = await supabase.from('shopping_list_items').delete().eq('id', id)
      if (error) {
        void fetchItems({ silent: true })
        return { error: error.message }
      }
      return { error: null }
    },
    [fetchItems],
  )

  const updateListQuantity = useCallback(
    async (id: string, quantity: number) => {
      if (quantity <= 0) {
        return removeFromList(id)
      }

      setItems((prev) => prev.map((i) => (i.id === id ? { ...i, quantity } : i)))

      const { error } = await supabase
        .from('shopping_list_items')
        .update({ quantity })
        .eq('id', id)

      if (error) {
        void fetchItems({ silent: true })
        return { error: error.message }
      }
      return { error: null }
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

      setItems((prev) => prev.filter((i) => i.id !== listItem.id))
      await supabase.from('shopping_list_items').delete().eq('id', listItem.id)

      const displayName =
        (user?.user_metadata?.display_name as string | undefined) ?? 'Someone'
      await logActivity(
        isGeneral
          ? `${displayName} checked off ${listItem.name}`
          : `${displayName} bought ${purchasedQuantity} ${listItem.unit} of ${listItem.name}`,
      )

      return { error: null }
    },
    [household, user, logActivity],
  )

  return {
    items,
    loading,
    addToList,
    updateExistingItem,
    findDuplicate,
    removeFromList,
    updateListQuantity,
    completePurchase,
    refresh: fetchItems,
  }
}
