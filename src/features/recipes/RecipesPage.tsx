import { useEffect, useMemo, useState } from 'react'
import { Plus, ChefHat, Trash2, ShoppingCart, Link as LinkIcon, ImagePlus, Star } from 'lucide-react'
import { useRecipes } from '@/hooks/useRecipes'
import { useInventory } from '@/hooks/useInventory'
import { useShoppingList } from '@/hooks/useShoppingList'
import { useToast } from '@/hooks/useToast'
import type { RecipeL1Category, RecipeWithDetails } from '@/types/database'
import { getPrimaryRecipeImage, hasRecipeMacros } from '@/types/database'
import { RECIPE_L1_CATEGORIES, UNITS } from '@/lib/constants'
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
import { cn } from '@/lib/utils'

type IngredientForm = {
  name: string
  quantity: number
  unit: string
  inventory_item_id: string | null
}

type ImageForm = {
  url: string
  is_primary: boolean
}

const RECIPE_L1_ORDER: RecipeL1Category[] = ['starters', 'entrees', 'desserts']

export function RecipesPage() {
  const { recipes, loading, saveRecipe, deleteRecipe, uploadRecipeImage } = useRecipes()
  const { items: pantryItems } = useInventory('pantry')
  const { addToList } = useShoppingList()
  const { showToast } = useToast()

  const [selectedRecipe, setSelectedRecipe] = useState<RecipeWithDetails | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editingRecipe, setEditingRecipe] = useState<RecipeWithDetails | null>(null)

  const groupedRecipes = useMemo(() => {
    const groups: Record<string, RecipeWithDetails[]> = {
      starters: [],
      entrees: [],
      desserts: [],
      other: [],
    }
    for (const recipe of recipes) {
      if (recipe.l1 && groups[recipe.l1]) {
        groups[recipe.l1].push(recipe)
      } else {
        groups.other.push(recipe)
      }
    }
    return groups
  }, [recipes])

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
          category_id: null,
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
        <div className="space-y-6">
          {RECIPE_L1_ORDER.map((l1) => {
            const items = groupedRecipes[l1]
            if (items.length === 0) return null
            const label = RECIPE_L1_CATEGORIES.find((c) => c.value === l1)?.label ?? l1
            return (
              <RecipeGroup
                key={l1}
                title={label}
                recipes={items}
                onSelect={setSelectedRecipe}
              />
            )
          })}
          {groupedRecipes.other.length > 0 && (
            <RecipeGroup
              title="Other"
              recipes={groupedRecipes.other}
              onSelect={setSelectedRecipe}
            />
          )}
        </div>
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
        onUploadImage={uploadRecipeImage}
        onError={showToast}
        onSave={async (data) => {
          const { error } = await saveRecipe(data)
          if (error) showToast(`Failed to save recipe: ${error}`)
          else {
            setShowForm(false)
            setEditingRecipe(null)
          }
        }}
      />
    </div>
  )
}

function RecipeGroup({
  title,
  recipes,
  onSelect,
}: {
  title: string
  recipes: RecipeWithDetails[]
  onSelect: (recipe: RecipeWithDetails) => void
}) {
  return (
    <section>
      <h3 className="text-sm font-medium text-muted-foreground mb-2">{title}</h3>
      <ul className="space-y-2">
        {recipes.map((recipe) => {
          const imageUrl = getPrimaryRecipeImage(recipe.recipe_images ?? [])
          return (
            <li key={recipe.id}>
              <Card
                className="cursor-pointer transition-colors active:bg-accent/30 overflow-hidden"
                onClick={() => onSelect(recipe)}
              >
                <CardContent className="p-0">
                  <div className="flex items-center">
                    {imageUrl && (
                      <div className="w-20 h-20 shrink-0 ml-3">
                        <img
                          src={imageUrl}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}
                    <div className="p-4 min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-medium">{recipe.title}</p>
                          <p className="text-sm text-muted-foreground">
                            {recipe.servings} servings
                            {recipe.prep_minutes != null && ` · ${recipe.prep_minutes}m prep`}
                            {recipe.cook_minutes != null && ` · ${recipe.cook_minutes}m cook`}
                          </p>
                          {recipe.recipe_type && (
                            <Badge variant="outline" className="mt-1">
                              {recipe.recipe_type}
                            </Badge>
                          )}
                          {hasRecipeMacros(recipe.recipe_macros) && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {recipe.recipe_macros?.calories != null && (
                                <Badge variant="secondary">
                                  {recipe.recipe_macros.calories} cal
                                </Badge>
                              )}
                              {recipe.recipe_macros?.protein_g != null && (
                                <Badge variant="outline">
                                  {recipe.recipe_macros.protein_g}g protein
                                </Badge>
                              )}
                            </div>
                          )}
                        </div>
                        <Badge variant="secondary">
                          {recipe.recipe_ingredients.length} ingredients
                        </Badge>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </li>
          )
        })}
      </ul>
    </section>
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
  const showMacros = hasRecipeMacros(macros)
  const primaryImage = getPrimaryRecipeImage(recipe.recipe_images ?? [])

  return (
    <Dialog open={!!recipe} onOpenChange={() => onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{recipe.title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {primaryImage && (
            <img
              src={primaryImage}
              alt={recipe.title}
              className="w-full max-h-48 object-cover rounded-lg"
            />
          )}

          <p className="text-sm text-muted-foreground">
            Serves {recipe.servings}
            {recipe.prep_minutes != null && ` · Prep ${recipe.prep_minutes} min`}
            {recipe.cook_minutes != null && ` · Cook ${recipe.cook_minutes} min`}
            {recipe.recipe_type && ` · ${recipe.recipe_type}`}
          </p>

          {recipe.source_url && (
            <a
              href={recipe.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
            >
              <LinkIcon className="h-4 w-4" />
              View original recipe
            </a>
          )}

          {showMacros && macros && (
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

          {(recipe.recipe_images?.length ?? 0) > 1 && (
            <div>
              <p className="text-sm font-medium mb-2">Photos</p>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {recipe.recipe_images.map((img) => (
                  <img
                    key={img.id}
                    src={img.url}
                    alt=""
                    className={cn(
                      'h-16 w-16 rounded-lg object-cover shrink-0',
                      img.is_primary && 'ring-2 ring-primary',
                    )}
                  />
                ))}
              </div>
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
  onUploadImage,
  onError,
  onSave,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  recipe: RecipeWithDetails | null
  pantryItems: Array<{ id: string; name: string }>
  onUploadImage: (file: File) => Promise<{ error: string | null; url: string | null }>
  onError: (message: string) => void
  onSave: (data: {
    id?: string
    title: string
    servings: number
    instructions: string
    prep_minutes: number | null
    cook_minutes: number | null
    l1: RecipeL1Category | null
    recipe_type: string | null
    source_url: string | null
    ingredients: IngredientForm[]
    macros: {
      calories: number | null
      protein_g: number | null
      carbs_g: number | null
      fat_g: number | null
    }
    images: ImageForm[]
  }) => Promise<void>
}) {
  const [title, setTitle] = useState('')
  const [servings, setServings] = useState('4')
  const [instructions, setInstructions] = useState('')
  const [prepMinutes, setPrepMinutes] = useState('')
  const [cookMinutes, setCookMinutes] = useState('')
  const [l1, setL1] = useState<string>('none')
  const [recipeType, setRecipeType] = useState('')
  const [sourceUrl, setSourceUrl] = useState('')
  const [ingredients, setIngredients] = useState<IngredientForm[]>([
    { name: '', quantity: 1, unit: 'each', inventory_item_id: null },
  ])
  const [images, setImages] = useState<ImageForm[]>([])
  const [imageUrlInput, setImageUrlInput] = useState('')
  const [calories, setCalories] = useState('')
  const [protein, setProtein] = useState('')
  const [carbs, setCarbs] = useState('')
  const [fat, setFat] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    if (!open) return
    if (recipe) {
      setTitle(recipe.title)
      setServings(String(recipe.servings))
      setInstructions(recipe.instructions)
      setPrepMinutes(recipe.prep_minutes != null ? String(recipe.prep_minutes) : '')
      setCookMinutes(recipe.cook_minutes != null ? String(recipe.cook_minutes) : '')
      setL1(recipe.l1 ?? 'none')
      setRecipeType(recipe.recipe_type ?? '')
      setSourceUrl(recipe.source_url ?? '')
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
      setImages(
        (recipe.recipe_images ?? []).map((img) => ({
          url: img.url,
          is_primary: img.is_primary,
        })),
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
      setL1('none')
      setRecipeType('')
      setSourceUrl('')
      setIngredients([{ name: '', quantity: 1, unit: 'each', inventory_item_id: null }])
      setImages([])
      setCalories('')
      setProtein('')
      setCarbs('')
      setFat('')
    }
    setImageUrlInput('')
  }, [open, recipe])

  const setPrimaryImage = (index: number) => {
    setImages((prev) => prev.map((img, i) => ({ ...img, is_primary: i === index })))
  }

  const removeImage = (index: number) => {
    setImages((prev) => {
      const next = prev.filter((_, i) => i !== index)
      if (next.length > 0 && !next.some((img) => img.is_primary)) {
        next[0] = { ...next[0], is_primary: true }
      }
      return next
    })
  }

  const addImageUrl = () => {
    const url = imageUrlInput.trim()
    if (!url) return
    setImages((prev) => [
      ...prev,
      { url, is_primary: prev.length === 0 },
    ])
    setImageUrlInput('')
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    const { error, url } = await onUploadImage(file)
    setUploading(false)
    e.target.value = ''
    if (error || !url) {
      onError(`Failed to upload image: ${error ?? 'Unknown error'}`)
      return
    }
    setImages((prev) => [...prev, { url, is_primary: prev.length === 0 }])
  }

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
      l1: l1 === 'none' ? null : (l1 as RecipeL1Category),
      recipe_type: recipeType.trim() || null,
      source_url: sourceUrl.trim() || null,
      ingredients: ingredients.filter((i) => i.name.trim()),
      macros: {
        calories: calories ? parseFloat(calories) : null,
        protein_g: protein ? parseFloat(protein) : null,
        carbs_g: carbs ? parseFloat(carbs) : null,
        fat_g: fat ? parseFloat(fat) : null,
      },
      images,
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

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={l1} onValueChange={setL1}>
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {RECIPE_L1_CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Type (optional)</Label>
              <Input
                placeholder="e.g. Italian, Quick"
                value={recipeType}
                onChange={(e) => setRecipeType(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Original recipe link</Label>
            <Input
              type="url"
              placeholder="https://..."
              value={sourceUrl}
              onChange={(e) => setSourceUrl(e.target.value)}
            />
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
            <Label className="mb-2 block">Images</Label>
            {images.length > 0 && (
              <div className="grid grid-cols-3 gap-2 mb-3">
                {images.map((img, idx) => (
                  <div key={idx} className="relative group">
                    <img
                      src={img.url}
                      alt=""
                      className={cn(
                        'w-full h-20 object-cover rounded-lg',
                        img.is_primary && 'ring-2 ring-primary',
                      )}
                    />
                    <div className="absolute inset-0 flex items-end justify-between p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        type="button"
                        onClick={() => setPrimaryImage(idx)}
                        className={cn(
                          'rounded-full p-1 bg-background/80',
                          img.is_primary && 'text-primary',
                        )}
                        title="Set as primary"
                      >
                        <Star className="h-3 w-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeImage(idx)}
                        className="rounded-full p-1 bg-background/80 text-destructive"
                        title="Remove"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                    {img.is_primary && (
                      <span className="absolute top-1 left-1 text-[10px] bg-primary text-primary-foreground px-1 rounded">
                        Primary
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <Input
                placeholder="Image URL"
                value={imageUrlInput}
                onChange={(e) => setImageUrlInput(e.target.value)}
              />
              <Button type="button" variant="outline" onClick={addImageUrl}>
                Add
              </Button>
            </div>
            <label className="mt-2 flex items-center justify-center gap-2 rounded-lg border border-dashed p-3 cursor-pointer hover:bg-accent/50 transition-colors">
              <ImagePlus className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                {uploading ? 'Uploading…' : 'Upload image'}
              </span>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => void handleFileUpload(e)}
                disabled={uploading}
              />
            </label>
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
            <Label className="mb-2 block">Macros per serving (optional)</Label>
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

          <Button type="submit" className="w-full" disabled={submitting || uploading}>
            {submitting ? 'Saving…' : 'Save recipe'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
