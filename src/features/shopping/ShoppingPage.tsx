import { useMemo, useState } from 'react'
import { Plus, ShoppingCart, Check } from 'lucide-react'
import { useShoppingList } from '@/hooks/useShoppingList'
import { useCategories } from '@/hooks/useCategories'
import type { ShoppingListItemWithMeta } from '@/hooks/useShoppingList'
import { formatQuantity } from '@/lib/utils'
import { UNITS } from '@/lib/constants'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
  DialogDescription,
} from '@/components/ui/dialog'

export function ShoppingPage() {
  const { items, loading, addToList, completePurchase } = useShoppingList()
  const { categories: pantryCategories } = useCategories('pantry')
  const { categories: supplyCategories } = useCategories('supply')

  const [search, setSearch] = useState('')
  const [l1Filter, setL1Filter] = useState<string>('all')
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [purchaseItem, setPurchaseItem] = useState<ShoppingListItemWithMeta | null>(null)
  const [purchasedQty, setPurchasedQty] = useState('')
  const [createInventory, setCreateInventory] = useState(true)

  const filteredItems = useMemo(() => {
    let result = [...items]
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter((i) => i.name.toLowerCase().includes(q))
    }
    if (l1Filter !== 'all') {
      result = result.filter((i) => i.l1 === l1Filter)
    }
    return result
  }, [items, search, l1Filter])

  const grouped = useMemo(() => {
    const pantry = filteredItems.filter((i) => i.l1 === 'pantry')
    const supply = filteredItems.filter((i) => i.l1 === 'supply')
    return { pantry, supply }
  }, [filteredItems])

  const openPurchase = (item: ShoppingListItemWithMeta) => {
    setPurchaseItem(item)
    setPurchasedQty(String(item.quantity))
    setCreateInventory(!item.inventory_item_id)
  }

  const handlePurchase = async () => {
    if (!purchaseItem) return
    await completePurchase(
      purchaseItem,
      parseFloat(purchasedQty) || 0,
      createInventory && !purchaseItem.inventory_item_id,
    )
    setPurchaseItem(null)
  }

  if (loading) return <LoadingSpinner />

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Shopping List</h2>
        <Button size="sm" onClick={() => setShowAddDialog(true)}>
          <Plus className="h-4 w-4" />
          Add
        </Button>
      </div>

      <div className="space-y-3">
        <Input
          placeholder="Search list…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Select value={l1Filter} onValueChange={setL1Filter}>
          <SelectTrigger>
            <SelectValue placeholder="Filter" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All items</SelectItem>
            <SelectItem value="pantry">Pantry</SelectItem>
            <SelectItem value="supply">Supply</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filteredItems.length === 0 ? (
        <EmptyState
          icon={ShoppingCart}
          title="Shopping list is empty"
          description="Add items manually or from low-stock alerts in Pantry and Supply."
          action={
            <Button onClick={() => setShowAddDialog(true)}>
              <Plus className="h-4 w-4" />
              Add item
            </Button>
          }
        />
      ) : (
        <div className="space-y-6">
          {grouped.pantry.length > 0 && (l1Filter === 'all' || l1Filter === 'pantry') && (
            <ShoppingGroup title="Pantry" items={grouped.pantry} onPurchase={openPurchase} />
          )}
          {grouped.supply.length > 0 && (l1Filter === 'all' || l1Filter === 'supply') && (
            <ShoppingGroup title="Supply" items={grouped.supply} onPurchase={openPurchase} />
          )}
        </div>
      )}

      <AddItemDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        pantryCategories={pantryCategories}
        supplyCategories={supplyCategories}
        onAdd={addToList}
      />

      <Dialog open={!!purchaseItem} onOpenChange={() => setPurchaseItem(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>How many did you buy?</DialogTitle>
            <DialogDescription>
              {purchaseItem?.name} will be added to your{' '}
              {purchaseItem?.l1 === 'pantry' ? 'Pantry' : 'Supply Closet'}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Quantity purchased</Label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  step="any"
                  min="0"
                  value={purchasedQty}
                  onChange={(e) => setPurchasedQty(e.target.value)}
                />
                <span className="flex items-center text-sm text-muted-foreground px-2">
                  {purchaseItem?.unit}
                </span>
              </div>
            </div>
            {!purchaseItem?.inventory_item_id && (
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={createInventory}
                  onChange={(e) => setCreateInventory(e.target.checked)}
                  className="rounded"
                />
                Create new inventory item
              </label>
            )}
            <Button className="w-full" onClick={() => void handlePurchase()}>
              Confirm purchase
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function ShoppingGroup({
  title,
  items,
  onPurchase,
}: {
  title: string
  items: ShoppingListItemWithMeta[]
  onPurchase: (item: ShoppingListItemWithMeta) => void
}) {
  return (
    <section>
      <h3 className="text-sm font-medium text-muted-foreground mb-2">{title}</h3>
      <ul className="space-y-2">
        {items.map((item) => (
          <li
            key={item.id}
            className="flex items-center justify-between rounded-xl border bg-card p-4"
          >
            <div className="min-w-0 flex-1">
              <p className="font-medium">{item.name}</p>
              <p className="text-sm text-muted-foreground">
                {formatQuantity(Number(item.quantity), item.unit)}
                {item.categories?.name && ` · ${item.categories.name}`}
              </p>
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={() => onPurchase(item)}
              title="Mark as purchased"
            >
              <Check className="h-4 w-4" />
            </Button>
          </li>
        ))}
      </ul>
    </section>
  )
}

function AddItemDialog({
  open,
  onOpenChange,
  pantryCategories,
  supplyCategories,
  onAdd,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  pantryCategories: Array<{ id: string; name: string }>
  supplyCategories: Array<{ id: string; name: string }>
  onAdd: (item: {
    name: string
    quantity: number
    unit: string
    l1: 'pantry' | 'supply'
    category_id?: string | null
  }) => Promise<{ error: string | null }>
}) {
  const [name, setName] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [unit, setUnit] = useState('each')
  const [l1, setL1] = useState<'pantry' | 'supply'>('pantry')
  const [categoryId, setCategoryId] = useState('none')

  const categories = l1 === 'pantry' ? pantryCategories : supplyCategories

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await onAdd({
      name: name.trim(),
      quantity: parseFloat(quantity) || 1,
      unit,
      l1,
      category_id: categoryId === 'none' ? null : categoryId,
    })
    setName('')
    setQuantity('1')
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add to shopping list</DialogTitle>
        </DialogHeader>
        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
          <div className="space-y-2">
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label>Type</Label>
            <Select value={l1} onValueChange={(v) => setL1(v as 'pantry' | 'supply')}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pantry">Pantry</SelectItem>
                <SelectItem value="supply">Supply</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-2">
              <Label>Quantity</Label>
              <Input
                type="number"
                step="any"
                min="0"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Unit</Label>
              <Select value={unit} onValueChange={setUnit}>
                <SelectTrigger>
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
            </div>
          </div>
          <div className="space-y-2">
            <Label>Category</Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" className="w-full">
            Add to list
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
