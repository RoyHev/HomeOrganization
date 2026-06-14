import { useEffect, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { Home } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { captureAuthLinkType, getAuthLinkType, getPendingPasswordSetup } from '@/lib/auth-utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { isSupabaseConfigured } from '@/lib/supabase'

function getLoginErrorMessage(error: { message: string; code: string | null }): string {
  if (error.code === 'email_not_confirmed') {
    return 'Email not confirmed. Check your inbox or ask an admin to confirm your account in Supabase.'
  }
  if (error.message === 'Invalid login credentials') {
    return 'Invalid email or password. If you were invited, you must set a password via the invite email first — or use Reset password below.'
  }
  return error.message
}

function getSupabaseProjectRef(): string | null {
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
  if (!url) return null
  try {
    return new URL(url).hostname.split('.')[0] ?? null
  } catch {
    return null
  }
}

export function LoginPage() {
  const navigate = useNavigate()
  const { user, signIn, resetPassword, loading, needsPasswordSetup } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [resetSent, setResetSent] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [resetting, setResetting] = useState(false)
  const projectRef = getSupabaseProjectRef()

  useEffect(() => {
    captureAuthLinkType()
    const type = getAuthLinkType() ?? getPendingPasswordSetup()
    if (type === 'invite' || type === 'recovery') {
      navigate(`/set-password${window.location.search}${window.location.hash}`, { replace: true })
    }
  }, [navigate])

  if (!loading && user && needsPasswordSetup) return <Navigate to="/set-password" replace />
  if (!loading && user) return <Navigate to="/" replace />

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    const result = await signIn(email, password)
    if (result) setError(getLoginErrorMessage(result))
    setSubmitting(false)
  }

  const handleResetPassword = async () => {
    if (!email.trim()) {
      setError('Enter your email above, then click Reset password.')
      return
    }
    setResetting(true)
    setError(null)
    setResetSent(false)
    const result = await resetPassword(email.trim())
    if (result) {
      setError(result.message)
    } else {
      setResetSent(true)
    }
    setResetting(false)
  }

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center px-4 py-8 safe-top safe-bottom">
      <div className="mb-8 flex flex-col items-center gap-2">
        <div className="rounded-2xl bg-primary/10 p-4">
          <Home className="h-10 w-10 text-primary" />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">Home Organizer</h1>
        <p className="text-sm text-muted-foreground">Pantry, shopping, recipes & supplies</p>
      </div>

      {!isSupabaseConfigured && (
        <div className="mb-4 w-full max-w-sm rounded-lg border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning-foreground space-y-1">
          <p className="font-medium">Setup required</p>
          <p>Copy <code className="text-xs bg-background/60 px-1 py-0.5 rounded">.env.example</code> to <code className="text-xs bg-background/60 px-1 py-0.5 rounded">.env</code> and add your Supabase credentials, then restart the dev server.</p>
        </div>
      )}

      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Sign in</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            {resetSent && (
              <p className="text-sm text-muted-foreground">
                Password reset email sent. Check your inbox and follow the link to set a new password.
              </p>
            )}
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>
          <div className="mt-3 flex flex-col gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="w-full"
              disabled={resetting}
              onClick={() => void handleResetPassword()}
            >
              {resetting ? 'Sending reset email…' : 'Reset password'}
            </Button>
          </div>
          {import.meta.env.DEV && projectRef && (
            <p className="mt-3 text-center text-xs text-muted-foreground">
              Dev: connected to Supabase project <span className="font-mono">{projectRef}</span>
            </p>
          )}
          <p className="mt-4 text-center text-sm text-muted-foreground">
            Contact your household admin to get access.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
