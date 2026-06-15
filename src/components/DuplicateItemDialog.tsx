import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

interface DuplicateItemDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  itemName: string
  existingQuantity: number
  existingUnit: string
  newQuantity: number
  newUnit: string
  onAddToExisting: () => void
  onReplace: () => void
}

export function DuplicateItemDialog({
  open,
  onOpenChange,
  itemName,
  existingQuantity,
  existingUnit,
  newQuantity,
  newUnit,
  onAddToExisting,
  onReplace,
}: DuplicateItemDialogProps) {
  const totalQty = existingQuantity + newQuantity

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Item already exists</DialogTitle>
          <DialogDescription>
            <span className="font-medium text-foreground">{itemName}</span> is already on this
            list with {existingQuantity} {existingUnit}.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          <Button onClick={onAddToExisting}>
            Add to existing ({totalQty} {newUnit || existingUnit})
          </Button>
          <Button variant="outline" onClick={onReplace}>
            Replace with {newQuantity} {newUnit}
          </Button>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
