import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useHousehold } from '@/hooks/useHousehold'
import type { Category, L1Category } from '@/types/database'

export function useCategories(l1: L1Category) {
  const { household } = useHousehold()
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)

  const fetchCategories = useCallback(async () => {
    if (!household) {
      setCategories([])
      setLoading(false)
      return
    }

    setLoading(true)
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .eq('household_id', household.id)
      .eq('l1', l1)
      .order('sort_order')

    if (!error && data) setCategories(data)
    setLoading(false)
  }, [household, l1])

  useEffect(() => {
    void fetchCategories()
  }, [fetchCategories])

  return { categories, loading, refresh: fetchCategories }
}
