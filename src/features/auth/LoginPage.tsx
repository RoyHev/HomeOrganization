import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { Home } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { isSupabaseConfigured } from '@/lib/supabase'

export function LoginPage() {
  const { user, signIn, loading } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (!loading && user) return <Navigate to="/" replace />

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    const { error: err } = await signIn(email, password)
    if (err) setError(err)
    setSubmitting(false)
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
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>
          <p className="mt-4 text-center text-sm text-muted-foreground">
            Contact your household admin to get access.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
