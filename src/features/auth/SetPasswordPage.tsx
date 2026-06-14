import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { Home } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { getAuthLinkType } from '@/lib/auth-utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { LoadingSpinner } from '@/components/ui/empty-state'

export function SetPasswordPage() {
  const { user, loading, needsPasswordSetup, updatePassword } = useAuth()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [ready, setReady] = useState(false)

  const linkType = getAuthLinkType()
  const isInvite = linkType === 'invite' || needsPasswordSetup

  useEffect(() => {
    if (linkType === 'invite' || linkType === 'recovery' || needsPasswordSetup) {
      setReady(true)
    }
  }, [linkType, needsPasswordSetup])

  if (loading) return <LoadingSpinner className="min-h-dvh" />

  if (!user) return <Navigate to="/login" replace />

  if (!ready && !needsPasswordSetup) return <Navigate to="/" replace />

  if (done) return <Navigate to="/" replace />

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setSubmitting(true)
    const result = await updatePassword(password)
    if (result) {
      setError(result.message)
      setSubmitting(false)
      return
    }
    setDone(true)
  }

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center px-4 py-8 safe-top safe-bottom">
      <div className="mb-8 flex flex-col items-center gap-2">
        <div className="rounded-2xl bg-primary/10 p-4">
          <Home className="h-10 w-10 text-primary" />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">Home Organizer</h1>
      </div>

      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>{isInvite ? 'Set your password' : 'Choose a new password'}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {isInvite
                ? 'Welcome! Create a password to finish setting up your account.'
                : 'Enter a new password for your account.'}
            </p>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm password</Label>
              <Input
                id="confirmPassword"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? 'Saving…' : 'Save password'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
