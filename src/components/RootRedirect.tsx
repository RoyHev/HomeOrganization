import { Navigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { LoadingSpinner } from '@/components/ui/empty-state'

export function RootRedirect() {
  const { user, loading, needsPasswordSetup } = useAuth()

  if (loading) return <LoadingSpinner className="min-h-dvh" />
  if (!user) return <Navigate to="/login" replace />
  if (needsPasswordSetup) return <Navigate to="/set-password" replace />
  return <Navigate to="/pantry" replace />
}
