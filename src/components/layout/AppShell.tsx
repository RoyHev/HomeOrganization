import { Outlet, Navigate } from 'react-router-dom'
import { BottomNav } from './BottomNav'
import { HeaderMenu } from './HeaderMenu'
import { useAuth } from '@/hooks/useAuth'
import { useHousehold } from '@/hooks/useHousehold'
import { LoadingSpinner } from '@/components/ui/empty-state'

export function AppShell() {
  const { user, needsPasswordSetup } = useAuth()
  const { household, loading } = useHousehold()

  if (loading) return <LoadingSpinner />
  if (!user) return <Navigate to="/login" replace />
  if (needsPasswordSetup) return <Navigate to="/set-password" replace />
  if (!household) return <Navigate to="/household" replace />

  return (
    <div className="min-h-dvh pb-[72px]">
      <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur safe-top">
        <div className="mx-auto flex max-w-lg items-center gap-3 px-4 py-3">
          <HeaderMenu />
          <div className="min-w-0 flex-1">
            <p className="text-xs text-muted-foreground">Household</p>
            <h1 className="truncate text-base font-semibold">{household.name}</h1>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-lg px-4 py-4">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  )
}
