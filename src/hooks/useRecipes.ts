import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useHousehold } from '@/hooks/useHousehold'
import type { RecipeWithDetails } from '@/types/database'

export function useRecipes() {
  const { household } = useHousehold()
  const [recipes, setRecipes] = useState<RecipeWithDetails[]>([])
  const [loading, setLoading] = useState(true)

  const fetchRecipes = useCallback(async () => {
    if (!household) {
      setRecipes([])
      setLoading(false)
      return
    }

    setLoading(true)
    const { data, error } = await supabase
      .from('recipes')
      .select('*, recipe_ingredients(*), recipe_macros(*)')
      .eq('household_id', household.id)
      .order('title')

    if (!error && data) {
      setRecipes(
        data.map((r) => ({
          ...r,
          recipe_ingredients: (r.recipe_ingredients ?? []).sort(
            (a, b) => a.sort_order - b.sort_order,
          ),
          recipe_macros: Array.isArray(r.recipe_macros) ? r.recipe_macros[0] ?? null : r.recipe_macros,
        })) as RecipeWithDetails[],
      )
    }
    setLoading(false)
  }, [household])

  useEffect(() => {
    void fetchRecipes()
  }, [fetchRecipes])

  useEffect(() => {
    if (!household) return

    const channel = supabase
      .channel(`recipes-${household.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'recipes',
          filter: `household_id=eq.${household.id}`,
        },
        () => {
          void fetchRecipes()
        },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [household, fetchRecipes])

  const saveRecipe = useCallback(
    async (recipe: {
      id?: string
      title: string
      servings: number
      instructions: string
      prep_minutes: number | null
      cook_minutes: number | null
      ingredients: Array<{
        name: string
        quantity: number
        unit: string
        inventory_item_id: string | null
      }>
      macros: {
        calories: number | null
        protein_g: number | null
        carbs_g: number | null
        fat_g: number | null
      }
    }) => {
      if (!household) return { error: 'No household', id: null }

      let recipeId = recipe.id

      if (recipeId) {
        const { error } = await supabase
          .from('recipes')
          .update({
            title: recipe.title,
            servings: recipe.servings,
            instructions: recipe.instructions,
            prep_minutes: recipe.prep_minutes,
            cook_minutes: recipe.cook_minutes,
          })
          .eq('id', recipeId)

        if (error) return { error: error.message, id: null }

        await supabase.from('recipe_ingredients').delete().eq('recipe_id', recipeId)
      } else {
        const { data, error } = await supabase
          .from('recipes')
          .insert({
            household_id: household.id,
            title: recipe.title,
            servings: recipe.servings,
            instructions: recipe.instructions,
            prep_minutes: recipe.prep_minutes,
            cook_minutes: recipe.cook_minutes,
          })
          .select()
          .single()

        if (error || !data) return { error: error?.message ?? 'Failed', id: null }
        recipeId = data.id
      }

      if (recipe.ingredients.length > 0) {
        await supabase.from('recipe_ingredients').insert(
          recipe.ingredients.map((ing, i) => ({
            recipe_id: recipeId!,
            name: ing.name,
            quantity: ing.quantity,
            unit: ing.unit,
            inventory_item_id: ing.inventory_item_id,
            sort_order: i,
          })),
        )
      }

      await supabase.from('recipe_macros').upsert({
        recipe_id: recipeId!,
        ...recipe.macros,
      })

      await fetchRecipes()
      return { error: null, id: recipeId }
    },
    [household, fetchRecipes],
  )

  const deleteRecipe = useCallback(
    async (id: string) => {
      const { error } = await supabase.from('recipes').delete().eq('id', id)
      if (!error) await fetchRecipes()
      return { error: error?.message ?? null }
    },
    [fetchRecipes],
  )

  return { recipes, loading, saveRecipe, deleteRecipe, refresh: fetchRecipes }
}
