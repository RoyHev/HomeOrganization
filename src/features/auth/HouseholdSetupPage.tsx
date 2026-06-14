import { useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { Users, Plus, Shield } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useHousehold } from '@/hooks/useHousehold'
import { usePlatformAdmin } from '@/hooks/usePlatformAdmin'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { LoadingSpinner } from '@/components/ui/empty-state'

export function HouseholdSetupPage() {
  const { user, loading: authLoading, needsPasswordSetup } = useAuth()
  const { household, createHousehold, joinHousehold, loading } = useHousehold()
  const { isPlatformAdmin } = usePlatformAdmin()
  const [mode, setMode] = useState<'choose' | 'create' | 'join'>('choose')
  const [householdName, setHouseholdName] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (authLoading || loading) return <LoadingSpinner />
  if (!user) return <Navigate to="/login" replace />
  if (needsPasswordSetup) return <Navigate to="/set-password" replace />
  if (household) return <Navigate to="/pantry" replace />

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    const { error: err } = await createHousehold(householdName)
    if (err) setError(err)
    setSubmitting(false)
  }

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    const { error: err } = await joinHousehold(inviteCode)
    if (err) setError(err)
    setSubmitting(false)
  }

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center px-4 py-8 safe-top safe-bottom">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Set up your household</CardTitle>
        </CardHeader>
        <CardContent>
          {mode === 'choose' && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground mb-4">
                Create a new household or join an existing one with an invite code.
              </p>
              <Button className="w-full justify-start gap-3" onClick={() => setMode('create')}>
                <Plus className="h-5 w-5" />
                Create household
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start gap-3"
                onClick={() => setMode('join')}
              >
                <Users className="h-5 w-5" />
                Join with invite code
              </Button>
              {isPlatformAdmin && (
                <Button variant="secondary" className="w-full justify-start gap-3" asChild>
                  <Link to="/platform-admin">
                    <Shield className="h-5 w-5" />
                    Platform admin
                  </Link>
                </Button>
              )}
            </div>
          )}

          {mode === 'create' && (
            <form onSubmit={(e) => void handleCreate(e)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="householdName">Household name</Label>
                <Input
                  id="householdName"
                  placeholder="e.g. The Smith Home"
                  value={householdName}
                  onChange={(e) => setHouseholdName(e.target.value)}
                  required
                />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => setMode('choose')}>
                  Back
                </Button>
                <Button type="submit" className="flex-1" disabled={submitting}>
                  {submitting ? 'Creating…' : 'Create'}
                </Button>
              </div>
            </form>
          )}

          {mode === 'join' && (
            <form onSubmit={(e) => void handleJoin(e)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="inviteCode">Invite code</Label>
                <Input
                  id="inviteCode"
                  placeholder="ABC123"
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                  className="uppercase tracking-widest"
                  required
                />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => setMode('choose')}>
                  Back
                </Button>
                <Button type="submit" className="flex-1" disabled={submitting}>
                  {submitting ? 'Joining…' : 'Join'}
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
