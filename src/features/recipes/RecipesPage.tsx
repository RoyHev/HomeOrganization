import { useEffect, useState } from 'react'
import { Plus, ChefHat, Trash2, ShoppingCart } from 'lucide-react'
import { useRecipes } from '@/hooks/useRecipes'
import { useInventory } from '@/hooks/useInventory'
import { useShoppingList } from '@/hooks/useShoppingList'
import type { RecipeWithDetails } from '@/types/database'
import { UNITS } from '@/lib/constants'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { EmptyState, LoadingSpinner } from '@/components/ui/empty-state'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Card, CardContent } from '@/components/ui/card'

type IngredientForm = {
  name: string
  quantity: number
  unit: string
  inventory_item_id: string | null
}

export function RecipesPage() {
  const { recipes, loading, saveRecipe, deleteRecipe } = useRecipes()
  const { items: pantryItems } = useInventory('pantry')
  const { addToList } = useShoppingList()

  const [selectedRecipe, setSelectedRecipe] = useState<RecipeWithDetails | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editingRecipe, setEditingRecipe] = useState<RecipeWithDetails | null>(null)

  const handleAddMissingToList = async (recipe: RecipeWithDetails) => {
    for (const ing of recipe.recipe_ingredients) {
      const pantryItem = ing.inventory_item_id
        ? pantryItems.find((p) => p.id === ing.inventory_item_id)
        : pantryItems.find((p) => p.name.toLowerCase() === ing.name.toLowerCase())

      const needed = Number(ing.quantity)
      const have = pantryItem ? Number(pantryItem.quantity) : 0

      if (have < needed) {
        await addToList({
          name: ing.name,
          quantity: needed - have,
          unit: ing.unit,
          l1: 'pantry',
          inventory_item_id: pantryItem?.id ?? null,
          category_id: pantryItem?.category_id ?? null,
        })
      }
    }
  }

  if (loading) return <LoadingSpinner />

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Recipes</h2>
        <Button
          size="sm"
          onClick={() => {
            setEditingRecipe(null)
            setShowForm(true)
          }}
        >
          <Plus className="h-4 w-4" />
          Add
        </Button>
      </div>

      {recipes.length === 0 ? (
        <EmptyState
          icon={ChefHat}
          title="No recipes yet"
          description="Save your favorite recipes with ingredients, instructions, and nutrition info."
          action={
            <Button onClick={() => setShowForm(true)}>
              <Plus className="h-4 w-4" />
              Add first recipe
            </Button>
          }
        />
      ) : (
        <ul className="space-y-2">
          {recipes.map((recipe) => (
            <li key={recipe.id}>
              <Card
                className="cursor-pointer transition-colors active:bg-accent/30"
                onClick={() => setSelectedRecipe(recipe)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium">{recipe.title}</p>
                      <p className="text-sm text-muted-foreground">
                        {recipe.servings} servings
                        {recipe.prep_minutes != null && ` · ${recipe.prep_minutes}m prep`}
                        {recipe.cook_minutes != null && ` · ${recipe.cook_minutes}m cook`}
                      </p>
                      {recipe.recipe_macros && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {recipe.recipe_macros.calories != null && (
                            <Badge variant="secondary">{recipe.recipe_macros.calories} cal</Badge>
                          )}
                          {recipe.recipe_macros.protein_g != null && (
                            <Badge variant="outline">{recipe.recipe_macros.protein_g}g protein</Badge>
                          )}
                        </div>
                      )}
                    </div>
                    <Badge variant="secondary">
                      {recipe.recipe_ingredients.length} ingredients
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <RecipeDetailDialog
        recipe={selectedRecipe}
        onClose={() => setSelectedRecipe(null)}
        onEdit={() => {
          if (selectedRecipe) {
            setEditingRecipe(selectedRecipe)
            setShowForm(true)
            setSelectedRecipe(null)
          }
        }}
        onDelete={async () => {
          if (selectedRecipe) {
            await deleteRecipe(selectedRecipe.id)
            setSelectedRecipe(null)
          }
        }}
        onAddMissing={() => selectedRecipe && void handleAddMissingToList(selectedRecipe)}
      />

      <RecipeFormDialog
        open={showForm}
        onOpenChange={setShowForm}
        recipe={editingRecipe}
        pantryItems={pantryItems.map((p) => ({ id: p.id, name: p.name }))}
        onSave={async (data) => {
          await saveRecipe(data)
          setShowForm(false)
          setEditingRecipe(null)
        }}
      />
    </div>
  )
}

function RecipeDetailDialog({
  recipe,
  onClose,
  onEdit,
  onDelete,
  onAddMissing,
}: {
  recipe: RecipeWithDetails | null
  onClose: () => void
  onEdit: () => void
  onDelete: () => void
  onAddMissing: () => void
}) {
  if (!recipe) return null

  const macros = recipe.recipe_macros

  return (
    <Dialog open={!!recipe} onOpenChange={() => onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{recipe.title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Serves {recipe.servings}
            {recipe.prep_minutes != null && ` · Prep ${recipe.prep_minutes} min`}
            {recipe.cook_minutes != null && ` · Cook ${recipe.cook_minutes} min`}
          </p>

          {macros && (
            <div className="rounded-lg bg-accent/50 p-3">
              <p className="text-sm font-medium mb-2">Macros per serving</p>
              <div className="grid grid-cols-2 gap-2 text-sm">
                {macros.calories != null && <span>Calories: {macros.calories}</span>}
                {macros.protein_g != null && <span>Protein: {macros.protein_g}g</span>}
                {macros.carbs_g != null && <span>Carbs: {macros.carbs_g}g</span>}
                {macros.fat_g != null && <span>Fat: {macros.fat_g}g</span>}
              </div>
            </div>
          )}

          <div>
            <p className="text-sm font-medium mb-2">Ingredients</p>
            <ul className="space-y-1 text-sm">
              {recipe.recipe_ingredients.map((ing) => (
                <li key={ing.id} className="text-muted-foreground">
                  {ing.quantity} {ing.unit} {ing.name}
                </li>
              ))}
            </ul>
          </div>

          {recipe.instructions && (
            <div>
              <p className="text-sm font-medium mb-2">Instructions</p>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                {recipe.instructions}
              </p>
            </div>
          )}

          <div className="flex flex-col gap-2">
            <Button onClick={onAddMissing}>
              <ShoppingCart className="h-4 w-4" />
              Add missing ingredients to list
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={onEdit}>
                Edit
              </Button>
              <Button variant="destructive" size="icon" onClick={() => void onDelete()}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function RecipeFormDialog({
  open,
  onOpenChange,
  recipe,
  pantryItems,
  onSave,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  recipe: RecipeWithDetails | null
  pantryItems: Array<{ id: string; name: string }>
  onSave: (data: {
    id?: string
    title: string
    servings: number
    instructions: string
    prep_minutes: number | null
    cook_minutes: number | null
    ingredients: IngredientForm[]
    macros: {
      calories: number | null
      protein_g: number | null
      carbs_g: number | null
      fat_g: number | null
    }
  }) => Promise<void>
}) {
  const [title, setTitle] = useState('')
  const [servings, setServings] = useState('4')
  const [instructions, setInstructions] = useState('')
  const [prepMinutes, setPrepMinutes] = useState('')
  const [cookMinutes, setCookMinutes] = useState('')
  const [ingredients, setIngredients] = useState<IngredientForm[]>([
    { name: '', quantity: 1, unit: 'each', inventory_item_id: null },
  ])
  const [calories, setCalories] = useState('')
  const [protein, setProtein] = useState('')
  const [carbs, setCarbs] = useState('')
  const [fat, setFat] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!open) return
    if (recipe) {
      setTitle(recipe.title)
      setServings(String(recipe.servings))
      setInstructions(recipe.instructions)
      setPrepMinutes(recipe.prep_minutes != null ? String(recipe.prep_minutes) : '')
      setCookMinutes(recipe.cook_minutes != null ? String(recipe.cook_minutes) : '')
      setIngredients(
        recipe.recipe_ingredients.length > 0
          ? recipe.recipe_ingredients.map((i) => ({
              name: i.name,
              quantity: Number(i.quantity),
              unit: i.unit,
              inventory_item_id: i.inventory_item_id,
            }))
          : [{ name: '', quantity: 1, unit: 'each', inventory_item_id: null }],
      )
      const m = recipe.recipe_macros
      setCalories(m?.calories != null ? String(m.calories) : '')
      setProtein(m?.protein_g != null ? String(m.protein_g) : '')
      setCarbs(m?.carbs_g != null ? String(m.carbs_g) : '')
      setFat(m?.fat_g != null ? String(m.fat_g) : '')
    } else {
      setTitle('')
      setServings('4')
      setInstructions('')
      setPrepMinutes('')
      setCookMinutes('')
      setIngredients([{ name: '', quantity: 1, unit: 'each', inventory_item_id: null }])
      setCalories('')
      setProtein('')
      setCarbs('')
      setFat('')
    }
  }, [open, recipe])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    await onSave({
      id: recipe?.id,
      title: title.trim(),
      servings: parseInt(servings, 10) || 4,
      instructions,
      prep_minutes: prepMinutes ? parseInt(prepMinutes, 10) : null,
      cook_minutes: cookMinutes ? parseInt(cookMinutes, 10) : null,
      ingredients: ingredients.filter((i) => i.name.trim()),
      macros: {
        calories: calories ? parseFloat(calories) : null,
        protein_g: protein ? parseFloat(protein) : null,
        carbs_g: carbs ? parseFloat(carbs) : null,
        fat_g: fat ? parseFloat(fat) : null,
      },
    })
    setSubmitting(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{recipe ? 'Edit recipe' : 'New recipe'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
          <div className="space-y-2">
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} required />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-2">
              <Label>Servings</Label>
              <Input
                type="number"
                min="1"
                value={servings}
                onChange={(e) => setServings(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Prep (min)</Label>
              <Input
                type="number"
                min="0"
                value={prepMinutes}
                onChange={(e) => setPrepMinutes(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Cook (min)</Label>
              <Input
                type="number"
                min="0"
                value={cookMinutes}
                onChange={(e) => setCookMinutes(e.target.value)}
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <Label>Ingredients</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() =>
                  setIngredients([
                    ...ingredients,
                    { name: '', quantity: 1, unit: 'each', inventory_item_id: null },
                  ])
                }
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <div className="space-y-2">
              {ingredients.map((ing, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-1">
                  <Input
                    className="col-span-5"
                    placeholder="Name"
                    value={ing.name}
                    onChange={(e) => {
                      const next = [...ingredients]
                      next[idx] = { ...ing, name: e.target.value }
                      setIngredients(next)
                    }}
                  />
                  <Input
                    className="col-span-2"
                    type="number"
                    step="any"
                    value={ing.quantity}
                    onChange={(e) => {
                      const next = [...ingredients]
                      next[idx] = { ...ing, quantity: parseFloat(e.target.value) || 0 }
                      setIngredients(next)
                    }}
                  />
                  <Select
                    value={ing.unit}
                    onValueChange={(v) => {
                      const next = [...ingredients]
                      next[idx] = { ...ing, unit: v }
                      setIngredients(next)
                    }}
                  >
                    <SelectTrigger className="col-span-3">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {UNITS.map((u) => (
                        <SelectItem key={u} value={u}>
                          {u}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={ing.inventory_item_id ?? 'none'}
                    onValueChange={(v) => {
                      const next = [...ingredients]
                      next[idx] = {
                        ...ing,
                        inventory_item_id: v === 'none' ? null : v,
                      }
                      setIngredients(next)
                    }}
                  >
                    <SelectTrigger className="col-span-2">
                      <SelectValue placeholder="Link" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">—</SelectItem>
                      {pantryItems.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Instructions</Label>
            <Textarea
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              rows={4}
            />
          </div>

          <div>
            <Label className="mb-2 block">Macros per serving</Label>
            <div className="grid grid-cols-2 gap-2">
              <Input
                placeholder="Calories"
                type="number"
                value={calories}
                onChange={(e) => setCalories(e.target.value)}
              />
              <Input
                placeholder="Protein (g)"
                type="number"
                value={protein}
                onChange={(e) => setProtein(e.target.value)}
              />
              <Input
                placeholder="Carbs (g)"
                type="number"
                value={carbs}
                onChange={(e) => setCarbs(e.target.value)}
              />
              <Input
                placeholder="Fat (g)"
                type="number"
                value={fat}
                onChange={(e) => setFat(e.target.value)}
              />
            </div>
          </div>

          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? 'Saving…' : 'Save recipe'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
