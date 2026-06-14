import { cn } from '@/lib/utils'

interface QuantityStepperProps {
  value: number
  unit?: string
  onDecrement: () => void
  onIncrement: () => void
  className?: string
  min?: number
}

function formatStepperValue(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/\.?0+$/, '')
}

function StepperControl({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string
  onClick: () => void
  disabled?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={cn(
        'flex h-10 w-10 shrink-0 items-center justify-center rounded-full',
        'text-foreground/70 transition-colors',
        'hover:text-foreground active:text-primary active:scale-90',
        'disabled:pointer-events-none disabled:opacity-30',
      )}
    >
      {children}
    </button>
  )
}

function MinusIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className="pointer-events-none"
    >
      <path
        d="M5 12h14"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  )
}

function PlusIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className="pointer-events-none"
    >
      <path
        d="M12 5v14M5 12h14"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function QuantityStepper({
  value,
  unit,
  onDecrement,
  onIncrement,
  className,
  min = 0,
}: QuantityStepperProps) {
  return (
    <div
      className={cn('flex items-center gap-0.5 shrink-0', className)}
      onClick={(e) => e.stopPropagation()}
    >
      <StepperControl
        label="Decrease quantity"
        onClick={onDecrement}
        disabled={value <= min}
      >
        <MinusIcon />
      </StepperControl>
      <div className="min-w-[2.75rem] px-1 text-center leading-tight">
        <span className="font-semibold tabular-nums text-base">{formatStepperValue(value)}</span>
        {unit && (
          <span className="block text-[10px] uppercase tracking-wide text-muted-foreground">
            {unit}
          </span>
        )}
      </div>
      <StepperControl label="Increase quantity" onClick={onIncrement}>
        <PlusIcon />
      </StepperControl>
    </div>
  )
}
