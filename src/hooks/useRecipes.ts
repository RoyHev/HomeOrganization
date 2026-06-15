import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useHousehold } from '@/hooks/useHousehold'
import type { RecipeImage, RecipeL1Category, RecipeWithDetails } from '@/types/database'
import { hasRecipeMacros } from '@/types/database'

export function useRecipes() {
  const { household } = useHousehold()
  const [recipes, setRecipes] = useState<RecipeWithDetails[]>([])
  const [loading, setLoading] = useState(true)

  const fetchRecipes = useCallback(async (opts?: { silent?: boolean }) => {
    if (!household) {
      setRecipes([])
      if (!opts?.silent) setLoading(false)
      return
    }

    if (!opts?.silent) setLoading(true)
    const { data, error } = await supabase
      .from('recipes')
      .select('*, recipe_ingredients(*), recipe_macros(*), recipe_images(*)')
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
          recipe_images: (r.recipe_images ?? []).sort((a, b) => a.sort_order - b.sort_order),
        })) as RecipeWithDetails[],
      )
    }
    if (!opts?.silent) setLoading(false)
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
          void fetchRecipes({ silent: true })
        },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [household, fetchRecipes])

  const uploadRecipeImage = useCallback(
    async (file: File) => {
      if (!household) return { error: 'No household', url: null }

      const ext = file.name.split('.').pop() ?? 'jpg'
      const path = `${household.id}/${Date.now()}.${ext}`

      const { error } = await supabase.storage.from('recipe-images').upload(path, file, {
        upsert: false,
      })

      if (error) return { error: error.message, url: null }

      const { data } = supabase.storage.from('recipe-images').getPublicUrl(path)
      return { error: null, url: data.publicUrl }
    },
    [household],
  )

  const saveRecipe = useCallback(
    async (recipe: {
      id?: string
      title: string
      servings: number
      instructions: string
      prep_minutes: number | null
      cook_minutes: number | null
      l1: RecipeL1Category | null
      recipe_type: string | null
      source_url: string | null
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
      images: Array<{ url: string; is_primary: boolean }>
    }) => {
      if (!household) return { error: 'No household', id: null }

      let recipeId = recipe.id

      const recipePayload = {
        title: recipe.title,
        servings: recipe.servings,
        instructions: recipe.instructions,
        prep_minutes: recipe.prep_minutes,
        cook_minutes: recipe.cook_minutes,
        l1: recipe.l1,
        recipe_type: recipe.recipe_type,
        source_url: recipe.source_url,
      }

      if (recipeId) {
        const { error } = await supabase
          .from('recipes')
          .update(recipePayload)
          .eq('id', recipeId)

        if (error) return { error: error.message, id: null }

        await supabase.from('recipe_ingredients').delete().eq('recipe_id', recipeId)
        await supabase.from('recipe_images').delete().eq('recipe_id', recipeId)
      } else {
        const { data, error } = await supabase
          .from('recipes')
          .insert({ household_id: household.id, ...recipePayload })
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

      if (hasRecipeMacros(recipe.macros)) {
        await supabase.from('recipe_macros').upsert({
          recipe_id: recipeId!,
          ...recipe.macros,
        })
      } else if (recipeId) {
        await supabase.from('recipe_macros').delete().eq('recipe_id', recipeId)
      }

      if (recipe.images.length > 0) {
        const hasPrimary = recipe.images.some((img) => img.is_primary)
        await supabase.from('recipe_images').insert(
          recipe.images.map((img, i) => ({
            recipe_id: recipeId!,
            url: img.url,
            is_primary: hasPrimary ? img.is_primary : i === 0,
            sort_order: i,
          })),
        )
      }

      await fetchRecipes({ silent: true })
      return { error: null, id: recipeId }
    },
    [household, fetchRecipes],
  )

  const deleteRecipe = useCallback(
    async (id: string) => {
      const { error } = await supabase.from('recipes').delete().eq('id', id)
      if (!error) await fetchRecipes({ silent: true })
      return { error: error?.message ?? null }
    },
    [fetchRecipes],
  )

  return { recipes, loading, saveRecipe, deleteRecipe, uploadRecipeImage, refresh: fetchRecipes }
}

export type { RecipeImage }
