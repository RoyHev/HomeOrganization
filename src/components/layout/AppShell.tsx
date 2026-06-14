import { Outlet, Navigate, useNavigate } from 'react-router-dom'
import { BottomNav } from './BottomNav'
import { useAuth } from '@/hooks/useAuth'
import { useHousehold } from '@/hooks/useHousehold'
import { LoadingSpinner } from '@/components/ui/empty-state'
import { LogOut, Settings } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function AppShell() {
  const { user, signOut } = useAuth()
  const { household, membership, loading } = useHousehold()
  const navigate = useNavigate()

  if (loading) return <LoadingSpinner />
  if (!user) return <Navigate to="/login" replace />
  if (!household) return <Navigate to="/household" replace />

  const isOwner = membership?.role === 'owner'

  return (
    <div className="min-h-dvh pb-[72px]">
      <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur safe-top">
        <div className="mx-auto flex max-w-lg items-center justify-between px-4 py-3">
          <div>
            <p className="text-xs text-muted-foreground">Household</p>
            <h1 className="text-base font-semibold">{household.name}</h1>
          </div>
          <div className="flex items-center gap-1">
            {isOwner && (
              <Button
                variant="ghost"
                size="icon"
                title="Admin settings"
                onClick={() => navigate('/admin')}
              >
                <Settings className="h-5 w-5" />
              </Button>
            )}
            <Button variant="ghost" size="icon" onClick={() => void signOut()}>
              <LogOut className="h-5 w-5" />
            </Button>
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
