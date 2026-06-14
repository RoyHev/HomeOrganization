import { useEffect, useMemo, useState } from 'react'
import { Plus, Search, AlertTriangle } from 'lucide-react'
import { useInventory } from '@/hooks/useInventory'
import { useCategories } from '@/hooks/useCategories'
import { useShoppingList } from '@/hooks/useShoppingList'
import type { InventoryItemWithCategory, L1Category } from '@/types/database'
import type { SortOption } from '@/lib/constants'
import { isLowStock, isOutOfStock, formatQuantity } from '@/lib/utils'
import { UNITS } from '@/lib/constants'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
  DialogDescription,
} from '@/components/ui/dialog'
import { Package } from 'lucide-react'

interface InventoryPageProps {
  l1: L1Category
  title: string
  emptyDescription: string
}

export function InventoryPage({ l1, title, emptyDescription }: InventoryPageProps) {
  const { items, loading, addItem, updateItem, deleteItem } = useInventory(l1)
  const { categories } = useCategories(l1)
  const { addToList } = useShoppingList()

  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [sort, setSort] = useState<SortOption>('name-asc')
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [editingItem, setEditingItem] = useState<InventoryItemWithCategory | null>(null)
  const [lowStockPrompt, setLowStockPrompt] = useState<InventoryItemWithCategory | null>(null)

  const filteredItems = useMemo(() => {
    let result = [...items]

    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter((i) => i.name.toLowerCase().includes(q))
    }

    if (categoryFilter !== 'all') {
      result = result.filter((i) => i.category_id === categoryFilter)
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
      case 'category':
        result.sort((a, b) =>
          (a.categories?.name ?? 'zzz').localeCompare(b.categories?.name ?? 'zzz'),
        )
        break
      case 'updated':
        result.sort(
          (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
        )
        break
    }

    return result
  }, [items, search, categoryFilter, sort])

  const lowStockItems = useMemo(() => {
    const now = new Date()
    return items.filter((item) => {
      if (item.snoozed_until && new Date(item.snoozed_until) > now) return false
      return isLowStock(Number(item.quantity), item.low_stock_threshold)
    })
  }, [items])

  const handleLowStockAction = async (
    item: InventoryItemWithCategory,
    action: 'add' | 'snooze' | 'dismiss',
  ) => {
    if (action === 'add') {
      await addToList({
        name: item.name,
        quantity: Math.max(1, Number(item.low_stock_threshold ?? 1)),
        unit: item.unit,
        l1: item.l1,
        inventory_item_id: item.id,
        category_id: item.category_id,
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
        <div className="grid grid-cols-2 gap-2">
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={sort} onValueChange={(v) => setSort(v as SortOption)}>
            <SelectTrigger>
              <SelectValue placeholder="Sort" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="name-asc">Name A–Z</SelectItem>
              <SelectItem value="name-desc">Name Z–A</SelectItem>
              <SelectItem value="quantity-asc">Quantity ↑</SelectItem>
              <SelectItem value="quantity-desc">Quantity ↓</SelectItem>
              <SelectItem value="category">Category</SelectItem>
              <SelectItem value="updated">Recently updated</SelectItem>
            </SelectContent>
          </Select>
        </div>
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
                  <p className="text-sm text-muted-foreground">
                    {item.categories?.name ?? 'Uncategorized'} ·{' '}
                    {formatQuantity(Number(item.quantity), item.unit)}
                  </p>
                </div>
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
        categories={categories}
        item={editingItem}
        onSave={async (data) => {
          if (editingItem) {
            await updateItem(editingItem.id, data)
          } else {
            await addItem(data)
          }
          setShowAddDialog(false)
          setEditingItem(null)
        }}
        onDelete={
          editingItem
            ? async () => {
                await deleteItem(editingItem.id)
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
          <div className="flex flex-col gap-2">
            <Button onClick={() => lowStockPrompt && void handleLowStockAction(lowStockPrompt, 'add')}>
              Yes, add to list
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
        </DialogContent>
      </Dialog>
    </div>
  )
}

interface ItemFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  l1: L1Category
  categories: Array<{ id: string; name: string }>
  item: InventoryItemWithCategory | null
  onSave: (data: {
    name: string
    quantity: number
    unit: string
    category_id: string | null
    low_stock_threshold: number | null
    notes?: string
  }) => Promise<void>
  onDelete?: () => Promise<void>
}

function ItemFormDialog({
  open,
  onOpenChange,
  categories,
  item,
  onSave,
  onDelete,
}: ItemFormDialogProps) {
  const [name, setName] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [unit, setUnit] = useState('each')
  const [categoryId, setCategoryId] = useState<string>('none')
  const [threshold, setThreshold] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!open) return
    if (item) {
      setName(item.name)
      setQuantity(String(item.quantity))
      setUnit(item.unit)
      setCategoryId(item.category_id ?? 'none')
      setThreshold(item.low_stock_threshold != null ? String(item.low_stock_threshold) : '')
      setNotes(item.notes ?? '')
    } else {
      setName('')
      setQuantity('1')
      setUnit('each')
      setCategoryId('none')
      setThreshold('1')
      setNotes('')
    }
  }, [open, item])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    await onSave({
      name: name.trim(),
      quantity: parseFloat(quantity) || 0,
      unit,
      category_id: categoryId === 'none' ? null : categoryId,
      low_stock_threshold: threshold ? parseFloat(threshold) : null,
      notes: notes || undefined,
    })
    setSubmitting(false)
  }

  return (
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
            <Label>Category</Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger>
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Uncategorized</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
  )
}
