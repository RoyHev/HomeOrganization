import { createContext, useCallback, useContext, useState } from 'react'
import { cn } from '@/lib/utils'

type Toast = { id: number; message: string; variant: 'error' | 'success' }

const ToastContext = createContext<{
  showToast: (message: string, variant?: 'error' | 'success') => void
} | null>(null)

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const showToast = useCallback((message: string, variant: 'error' | 'success' = 'error') => {
    const id = Date.now()
    setToasts((prev) => [...prev, { id, message, variant }])
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 4000)
  }, [])

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed bottom-20 left-0 right-0 z-50 flex flex-col items-center gap-2 px-4 pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={cn(
              'rounded-lg px-4 py-3 text-sm font-medium shadow-lg max-w-sm w-full text-center',
              toast.variant === 'error'
                ? 'bg-destructive text-destructive-foreground'
                : 'bg-foreground text-background',
            )}
          >
            {toast.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}
