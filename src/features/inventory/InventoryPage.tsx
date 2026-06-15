import { useEffect, useMemo, useState } from 'react'
import { Plus, Search, AlertTriangle } from 'lucide-react'
import { useInventory } from '@/hooks/useInventory'
import { useShoppingList } from '@/hooks/useShoppingList'
import { useToast } from '@/hooks/useToast'
import type { InventoryItemWithCategory, L1Category } from '@/types/database'
import type { SortOption } from '@/lib/constants'
import { isLowStock, isOutOfStock } from '@/lib/utils'
import { UNITS } from '@/lib/constants'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { EmptyState, LoadingSpinner } from '@/components/ui/empty-state'
import { QuantityStepper } from '@/components/QuantityStepper'
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
import { Package } from 'lucide-react'

interface InventoryPageProps {
  l1: L1Category
  title: string
  emptyDescription: string
}

export function InventoryPage({ l1, title, emptyDescription }: InventoryPageProps) {
  const { items, loading, addItem, updateItem, updateExistingItem, deleteItem } = useInventory(l1)
  const { addToList } = useShoppingList()
  const { showToast } = useToast()

  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<SortOption>('name-asc')
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [editingItem, setEditingItem] = useState<InventoryItemWithCategory | null>(null)
  const [lowStockPrompt, setLowStockPrompt] = useState<InventoryItemWithCategory | null>(null)
  const [lowStockAddQty, setLowStockAddQty] = useState(1)

  useEffect(() => {
    if (!lowStockPrompt) return
    setLowStockAddQty(Math.max(1, Number(lowStockPrompt.low_stock_threshold ?? 1)))
  }, [lowStockPrompt])

  const filteredItems = useMemo(() => {
    let result = [...items]

    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter((i) => i.name.toLowerCase().includes(q))
    }

    switch (sort) {
      case 'name-asc':
        result.sort((a, b) => a.name.localeCompare(b.name))
        break
      case 'name-desc':
        result.sort((a, b) => b.name.localeCompare(a.name))
        break
      case 'quantity-asc':
        result.sort((a, b) => Number(a.quantity) - Number(b.quantity))
        break
      case 'quantity-desc':
        result.sort((a, b) => Number(b.quantity) - Number(a.quantity))
        break
      case 'updated':
        result.sort(
          (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
        )
        break
    }

    return result
  }, [items, search, sort])

  const lowStockItems = useMemo(() => {
    const now = new Date()
    return items.filter((item) => {
      if (item.snoozed_until && new Date(item.snoozed_until) > now) return false
      return isLowStock(Number(item.quantity), item.low_stock_threshold)
    })
  }, [items])

  const handleQuantityChange = async (item: InventoryItemWithCategory, quantity: number) => {
    const { error } = await updateItem(item.id, { quantity })
    if (error) showToast(`Failed to update quantity: ${error}`)
  }

  const handleLowStockAction = async (
    item: InventoryItemWithCategory,
    action: 'add' | 'snooze' | 'dismiss',
    quantity?: number,
  ) => {
    if (action === 'add') {
      await addToList({
        name: item.name,
        quantity: Math.max(1, quantity ?? 1),
        unit: item.unit,
        l1: item.l1,
        inventory_item_id: item.id,
        category_id: null,
      })
    } else if (action === 'snooze') {
      const snoozeUntil = new Date()
      snoozeUntil.setDate(snoozeUntil.getDate() + 3)
      await updateItem(item.id, { snoozed_until: snoozeUntil.toISOString() })
    }
    setLowStockPrompt(null)
  }

  if (loading) return <LoadingSpinner />

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">{title}</h2>
        <Button size="sm" onClick={() => setShowAddDialog(true)}>
          <Plus className="h-4 w-4" />
          Add
        </Button>
      </div>

      {lowStockItems.length > 0 && (
        <div className="rounded-xl border border-warning/30 bg-warning/5 p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="h-4 w-4 text-warning-foreground" />
            <p className="text-sm font-medium">
              {lowStockItems.length} item{lowStockItems.length !== 1 ? 's' : ''} running low
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {lowStockItems.slice(0, 5).map((item) => (
              <Button
                key={item.id}
                variant="outline"
                size="sm"
                onClick={() => setLowStockPrompt(item)}
              >
                {item.name}
              </Button>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search items…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={sort} onValueChange={(v) => setSort(v as SortOption)}>
          <SelectTrigger>
            <SelectValue placeholder="Sort" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="name-asc">Name A–Z</SelectItem>
            <SelectItem value="name-desc">Name Z–A</SelectItem>
            <SelectItem value="quantity-asc">Quantity ↑</SelectItem>
            <SelectItem value="quantity-desc">Quantity ↓</SelectItem>
            <SelectItem value="updated">Recently updated</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filteredItems.length === 0 ? (
        <EmptyState
          icon={Package}
          title="No items yet"
          description={emptyDescription}
          action={
            <Button onClick={() => setShowAddDialog(true)}>
              <Plus className="h-4 w-4" />
              Add first item
            </Button>
          }
        />
      ) : (
        <ul className="space-y-2">
          {filteredItems.map((item) => {
            const outOfStock = isOutOfStock(Number(item.quantity))
            const low = isLowStock(Number(item.quantity), item.low_stock_threshold)
            return (
              <li
                key={item.id}
                className="flex items-center justify-between rounded-xl border bg-card p-4 cursor-pointer active:bg-accent/50 transition-colors"
                onClick={() => setEditingItem(item)}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium truncate">{item.name}</p>
                    {outOfStock && <Badge variant="destructive">Out</Badge>}
                    {!outOfStock && low && <Badge variant="warning">Low</Badge>}
                  </div>
                </div>
            <QuantityStepper
              value={Number(item.quantity)}
              unit={item.unit}
              min={0}
                  onDecrement={() =>
                    void handleQuantityChange(item, Math.max(0, Number(item.quantity) - 1))
                  }
                  onIncrement={() =>
                    void handleQuantityChange(item, Number(item.quantity) + 1)
                  }
                />
              </li>
            )
          })}
        </ul>
      )}

      <ItemFormDialog
        open={showAddDialog || !!editingItem}
        onOpenChange={(open) => {
          if (!open) {
            setShowAddDialog(false)
            setEditingItem(null)
          }
        }}
        l1={l1}
        item={editingItem}
        onSave={async (data) => {
          if (editingItem) {
            const { error } = await updateItem(editingItem.id, { ...data, category_id: null })
            if (error) {
              showToast(`Failed to save item: ${error}`)
              return null
            }
          } else {
            const result = await addItem({ ...data, category_id: null }, { mergeIfDuplicate: false })
            if (result.duplicate) {
              return { duplicate: result.duplicate, data }
            }
            if (result.error) {
              showToast(`Failed to add item: ${result.error}`)
              return null
            }
          }
          setShowAddDialog(false)
          setEditingItem(null)
          return null
        }}
        onUpdateDuplicate={async (id, data, mode) => {
          const { error } = await updateExistingItem(
            id,
            {
              quantity: data.quantity,
              unit: data.unit,
              low_stock_threshold: data.low_stock_threshold,
              notes: data.notes,
            },
            mode,
          )
          if (error) showToast(`Failed to update item: ${error}`)
          else {
            setShowAddDialog(false)
            setEditingItem(null)
          }
        }}
        onDelete={
          editingItem
            ? async () => {
                const { error } = await deleteItem(editingItem.id)
                if (error) showToast(`Failed to delete item: ${error}`)
                setEditingItem(null)
              }
            : undefined
        }
      />

      <Dialog open={!!lowStockPrompt} onOpenChange={() => setLowStockPrompt(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Add to shopping list?</DialogTitle>
            <DialogDescription>
              {lowStockPrompt?.name} is{' '}
              {isOutOfStock(Number(lowStockPrompt?.quantity ?? 0)) ? 'out of stock' : 'running low'}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex flex-col items-center gap-2">
              <Label>How many to add?</Label>
              <QuantityStepper
                value={lowStockAddQty}
                unit={lowStockPrompt?.unit}
                min={1}
                onDecrement={() => setLowStockAddQty((q) => Math.max(1, q - 1))}
                onIncrement={() => setLowStockAddQty((q) => q + 1)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Button
                onClick={() =>
                  lowStockPrompt &&
                  void handleLowStockAction(lowStockPrompt, 'add', lowStockAddQty)
                }
              >
                Add to shopping list
              </Button>
              <Button
                variant="outline"
                onClick={() => lowStockPrompt && void handleLowStockAction(lowStockPrompt, 'snooze')}
              >
                Snooze 3 days
              </Button>
              <Button variant="ghost" onClick={() => setLowStockPrompt(null)}>
                Not now
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

type ItemFormData = {
  name: string
  quantity: number
  unit: string
  low_stock_threshold: number | null
  notes?: string
}

interface ItemFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  l1: L1Category
  item: InventoryItemWithCategory | null
  onSave: (data: ItemFormData) => Promise<{ duplicate: InventoryItemWithCategory; data: ItemFormData } | null>
  onUpdateDuplicate: (id: string, data: ItemFormData, mode: 'add' | 'replace') => Promise<void>
  onDelete?: () => Promise<void>
}

function ItemFormDialog({
  open,
  onOpenChange,
  item,
  onSave,
  onUpdateDuplicate,
  onDelete,
}: ItemFormDialogProps) {
  const [name, setName] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [unit, setUnit] = useState('each')
  const [threshold, setThreshold] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [duplicate, setDuplicate] = useState<InventoryItemWithCategory | null>(null)
  const [pendingData, setPendingData] = useState<ItemFormData | null>(null)

  useEffect(() => {
    if (!open) return
    if (item) {
      setName(item.name)
      setQuantity(String(item.quantity))
      setUnit(item.unit)
      setThreshold(item.low_stock_threshold != null ? String(item.low_stock_threshold) : '')
      setNotes(item.notes ?? '')
    } else {
      setName('')
      setQuantity('1')
      setUnit('each')
      setThreshold('1')
      setNotes('')
    }
  }, [open, item])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    const data = {
      name: name.trim(),
      quantity: parseFloat(quantity) || 0,
      unit,
      low_stock_threshold: threshold ? parseFloat(threshold) : null,
      notes: notes || undefined,
    }
    const result = await onSave(data)
    if (result?.duplicate) {
      setDuplicate(result.duplicate)
      setPendingData(data)
    }
    setSubmitting(false)
  }

  const handleDuplicateAction = async (mode: 'add' | 'replace') => {
    if (!duplicate || !pendingData) return
    await onUpdateDuplicate(duplicate.id, pendingData, mode)
    setDuplicate(null)
    setPendingData(null)
  }

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{item ? 'Edit item' : 'Add item'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
          <div className="space-y-2">
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} required />
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
                required
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
            <Label>Low stock threshold</Label>
            <Input
              type="number"
              step="any"
              min="0"
              placeholder="Alert when at or below"
              value={threshold}
              onChange={(e) => setThreshold(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Notes (optional)</Label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <div className="flex gap-2">
            {onDelete && (
              <Button
                type="button"
                variant="destructive"
                onClick={() => void onDelete()}
              >
                Delete
              </Button>
            )}
            <Button type="submit" className="flex-1" disabled={submitting}>
              {submitting ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>

    <DuplicateItemDialog
      open={!!duplicate}
      onOpenChange={(v) => {
        if (!v) {
          setDuplicate(null)
          setPendingData(null)
        }
      }}
      itemName={duplicate?.name ?? ''}
      existingQuantity={Number(duplicate?.quantity ?? 0)}
      existingUnit={duplicate?.unit ?? ''}
      newQuantity={pendingData?.quantity ?? 0}
      newUnit={pendingData?.unit ?? ''}
      onAddToExisting={() => void handleDuplicateAction('add')}
      onReplace={() => void handleDuplicateAction('replace')}
    />
    </>
  )
}
