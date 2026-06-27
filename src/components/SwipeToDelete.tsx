import { useCallback, useRef, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'

const DELETE_WIDTH = 80
const OPEN_THRESHOLD = 40

interface SwipeToDeleteProps {
  children: React.ReactNode
  onDelete: () => void
  className?: string
}

export function SwipeToDelete({ children, onDelete, className }: SwipeToDeleteProps) {
  const trackRef = useRef<HTMLDivElement>(null)
  const startX = useRef(0)
  const startOffset = useRef(0)
  const didDrag = useRef(false)
  const [offset, setOffset] = useState(0)
  const [dragging, setDragging] = useState(false)

  const isOpen = offset < 0

  const clampOffset = useCallback((value: number) => Math.max(-DELETE_WIDTH, Math.min(0, value)), [])

  const snapOffset = useCallback(
    (value: number) => (value <= -OPEN_THRESHOLD ? -DELETE_WIDTH : 0),
    [],
  )

  const reset = useCallback(() => setOffset(0), [])

  const handlePointerDown = (e: React.PointerEvent) => {
    const target = e.target as HTMLElement
    if (target.closest('button, input, a, [role="button"]')) return

    startX.current = e.clientX
    startOffset.current = offset
    didDrag.current = false
    setDragging(true)
    trackRef.current?.setPointerCapture(e.pointerId)
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragging) return
    const delta = e.clientX - startX.current
    if (Math.abs(delta) > 8) didDrag.current = true
    setOffset(clampOffset(startOffset.current + delta))
  }

  const finishDrag = (e: React.PointerEvent) => {
    if (!dragging) return
    setDragging(false)
    trackRef.current?.releasePointerCapture(e.pointerId)
    setOffset((current) => snapOffset(current))
  }

  const handleClickCapture = (e: React.MouseEvent) => {
    if (didDrag.current) {
      e.preventDefault()
      e.stopPropagation()
      didDrag.current = false
      return
    }
    if (isOpen) reset()
  }

  const handleDelete = () => {
    reset()
    onDelete()
  }

  return (
    <div className={cn('relative overflow-hidden rounded-xl', className)}>
      <div
        className={cn(
          'absolute inset-y-0 right-0 flex items-center justify-center bg-destructive text-destructive-foreground transition-opacity duration-150',
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none',
        )}
        style={{ width: DELETE_WIDTH }}
        aria-hidden={!isOpen}
      >
        <button
          type="button"
          onClick={handleDelete}
          className="flex h-full w-full items-center justify-center"
          aria-label="Delete"
          tabIndex={isOpen ? 0 : -1}
        >
          <Trash2 className="h-5 w-5" />
        </button>
      </div>

      <div
        ref={trackRef}
        className={cn(
          'relative touch-pan-y select-none bg-card',
          !dragging && 'transition-transform duration-200 ease-out',
        )}
        style={{ transform: `translateX(${offset}px)` }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishDrag}
        onPointerCancel={finishDrag}
        onClickCapture={handleClickCapture}
      >
        {children}
      </div>
    </div>
  )
}
