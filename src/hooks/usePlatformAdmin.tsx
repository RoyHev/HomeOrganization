import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'

interface PlatformAdminContextValue {
  isPlatformAdmin: boolean
  loading: boolean
}

const PlatformAdminContext = createContext<PlatformAdminContextValue | null>(null)

export function PlatformAdminProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth()
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (authLoading) return

    if (!user) {
      setIsPlatformAdmin(false)
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)

    void supabase.rpc('is_platform_admin').then(({ data, error }) => {
      if (cancelled) return
      setIsPlatformAdmin(Boolean(data) && !error)
      setLoading(false)
    })

    return () => {
      cancelled = true
    }
  }, [user, authLoading])

  const value = useMemo(
    () => ({ isPlatformAdmin, loading }),
    [isPlatformAdmin, loading],
  )

  return (
    <PlatformAdminContext.Provider value={value}>{children}</PlatformAdminContext.Provider>
  )
}

export function usePlatformAdmin() {
  const ctx = useContext(PlatformAdminContext)
  if (!ctx) throw new Error('usePlatformAdmin must be used within PlatformAdminProvider')
  return ctx
}
