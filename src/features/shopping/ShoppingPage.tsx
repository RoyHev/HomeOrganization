import { useMemo, useState } from 'react'
import { Plus, ShoppingCart, Check } from 'lucide-react'
import { useShoppingList, type ShoppingListItemWithMeta } from '@/hooks/useShoppingList'
import { useToast } from '@/hooks/useToast'
import type { ShoppingListL1, ShoppingListItem } from '@/types/database'
import { UNITS } from '@/lib/constants'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { EmptyState, LoadingSpinner } from '@/components/ui/empty-state'
import { QuantityStepper } from '@/components/QuantityStepper'
import { SwipeToDelete } from '@/components/SwipeToDelete'
import { DuplicateItemDialog } from '@/components/DuplicateItemDialog'
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
  const {
    items,
    loading,
    addToList,
    updateExistingItem,
    updateListQuantity,
    completePurchase,
    removeFromList,
  } = useShoppingList()
  const { showToast } = useToast()

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
    const general = filteredItems.filter((i) => i.l1 === 'general')
    return { pantry, supply, general }
  }, [filteredItems])

  const handleQuantityChange = async (id: string, quantity: number) => {
    const { error } = await updateListQuantity(id, quantity)
    if (error) showToast(`Failed to update quantity: ${error}`)
  }

  const handleDelete = async (id: string) => {
    const { error } = await removeFromList(id)
    if (error) showToast(`Failed to remove item: ${error}`)
  }

  const handleItemCheck = (item: ShoppingListItemWithMeta) => {
    if (item.l1 === 'general') {
      void completePurchase(item, 0, false).then(({ error }) => {
        if (error) showToast(`Failed to check off item: ${error}`)
      })
      return
    }
    openPurchase(item)
  }

  const openPurchase = (item: ShoppingListItemWithMeta) => {
    setPurchaseItem(item)
    setPurchasedQty(String(item.quantity))
    setCreateInventory(!item.inventory_item_id)
  }

  const handlePurchase = async () => {
    if (!purchaseItem) return
    const { error } = await completePurchase(
      purchaseItem,
      parseFloat(purchasedQty) || 0,
      createInventory && !purchaseItem.inventory_item_id,
    )
    if (error) showToast(`Failed to complete purchase: ${error}`)
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
            <SelectItem value="general">Other</SelectItem>
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
            <ShoppingGroup
              title="Pantry"
              items={grouped.pantry}
              onCheck={handleItemCheck}
              onUpdateQuantity={handleQuantityChange}
              onDelete={handleDelete}
            />
          )}
          {grouped.supply.length > 0 && (l1Filter === 'all' || l1Filter === 'supply') && (
            <ShoppingGroup
              title="Supply"
              items={grouped.supply}
              onCheck={handleItemCheck}
              onUpdateQuantity={handleQuantityChange}
              onDelete={handleDelete}
            />
          )}
          {grouped.general.length > 0 && (l1Filter === 'all' || l1Filter === 'general') && (
            <ShoppingGroup
              title="Other"
              items={grouped.general}
              onCheck={handleItemCheck}
              onUpdateQuantity={handleQuantityChange}
              onDelete={handleDelete}
            />
          )}
        </div>
      )}

      <AddItemDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        onAdd={addToList}
        onUpdateExisting={updateExistingItem}
        onError={showToast}
      />

      <Dialog open={!!purchaseItem} onOpenChange={() => setPurchaseItem(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>How many did you buy?</DialogTitle>
            <DialogDescription>
              {purchaseItem?.l1 === 'pantry'
                ? `${purchaseItem.name} will be added to your Pantry.`
                : `${purchaseItem?.name} will be added to your Supply Closet.`}
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
  onCheck,
  onUpdateQuantity,
  onDelete,
}: {
  title: string
  items: ShoppingListItemWithMeta[]
  onCheck: (item: ShoppingListItemWithMeta) => void
  onUpdateQuantity: (id: string, quantity: number) => void
  onDelete: (id: string) => void
}) {
  return (
    <section>
      <h3 className="text-sm font-medium text-muted-foreground mb-2">{title}</h3>
      <ul className="space-y-2">
        {items.map((item) => (
          <li key={item.id}>
            <SwipeToDelete onDelete={() => void onDelete(item.id)}>
              <div className="flex items-center gap-3 border bg-card p-4">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{item.name}</p>
                </div>
                <QuantityStepper
                  value={Number(item.quantity)}
                  unit={item.unit}
                  onDecrement={() => onUpdateQuantity(item.id, Number(item.quantity) - 1)}
                  onIncrement={() => onUpdateQuantity(item.id, Number(item.quantity) + 1)}
                />
                <Button
                  variant="outline"
                  size="icon"
                  className="shrink-0"
                  onClick={() => onCheck(item)}
                  title={item.l1 === 'general' ? 'Check off' : 'Mark as purchased'}
                >
                  <Check className="h-4 w-4" />
                </Button>
              </div>
            </SwipeToDelete>
          </li>
        ))}
      </ul>
    </section>
  )
}

function AddItemDialog({
  open,
  onOpenChange,
  onAdd,
  onUpdateExisting,
  onError,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onAdd: (
    item: {
      name: string
      quantity: number
      unit: string
      l1: ShoppingListL1
      category_id?: string | null
    },
    opts?: { mergeIfDuplicate?: boolean },
  ) => Promise<{ error: string | null; duplicate?: ShoppingListItem }>
  onUpdateExisting: (
    id: string,
    updates: { quantity?: number; unit?: string },
    mode: 'add' | 'replace',
  ) => Promise<{ error: string | null }>
  onError: (message: string) => void
}) {
  const [name, setName] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [unit, setUnit] = useState('each')
  const [l1, setL1] = useState<ShoppingListL1>('pantry')
  const [duplicate, setDuplicate] = useState<ShoppingListItem | null>(null)

  const isGeneral = l1 === 'general'
  const parsedQty = parseFloat(quantity) || 1

  const resetForm = () => {
    setName('')
    setQuantity('1')
    setDuplicate(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const result = await onAdd(
      {
        name: name.trim(),
        quantity: parsedQty,
        unit,
        l1,
        category_id: null,
      },
      { mergeIfDuplicate: false },
    )

    if (result.duplicate) {
      setDuplicate(result.duplicate)
      return
    }

    if (result.error) {
      onError(`Failed to add item: ${result.error}`)
      return
    }

    resetForm()
    onOpenChange(false)
  }

  const handleDuplicateAction = async (mode: 'add' | 'replace') => {
    if (!duplicate) return
    const { error } = await onUpdateExisting(duplicate.id, { quantity: parsedQty, unit }, mode)
    if (error) {
      onError(`Failed to update item: ${error}`)
      return
    }
    resetForm()
    setDuplicate(null)
    onOpenChange(false)
  }

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(v) => {
          if (!v) resetForm()
          onOpenChange(v)
        }}
      >
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
              <Select value={l1} onValueChange={(v) => setL1(v as ShoppingListL1)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pantry">Pantry</SelectItem>
                  <SelectItem value="supply">Supply</SelectItem>
                  <SelectItem value="general">Other (list only)</SelectItem>
                </SelectContent>
              </Select>
              {isGeneral && (
                <p className="text-sm text-muted-foreground">
                  Won&apos;t be added to Pantry or Supply — just check off when done.
                </p>
              )}
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
            <Button type="submit" className="w-full">
              Add to list
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <DuplicateItemDialog
        open={!!duplicate}
        onOpenChange={(v) => !v && setDuplicate(null)}
        itemName={duplicate?.name ?? ''}
        existingQuantity={Number(duplicate?.quantity ?? 0)}
        existingUnit={duplicate?.unit ?? ''}
        newQuantity={parsedQty}
        newUnit={unit}
        onAddToExisting={() => void handleDuplicateAction('add')}
        onReplace={() => void handleDuplicateAction('replace')}
      />
    </>
  )
}
