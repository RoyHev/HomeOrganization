import { useCallback, useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { ArrowLeft, Building2, Shield, Trash2, UserPlus, Users } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { usePlatformAdmin } from '@/hooks/usePlatformAdmin'
import { useHousehold } from '@/hooks/useHousehold'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { LoadingSpinner } from '@/components/ui/empty-state'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

type HouseholdRow = {
  id: string
  name: string
  invite_code: string
  member_count: number
  created_at: string
}

type UserRow = {
  user_id: string
  email: string
  display_name: string | null
  household_id: string | null
  household_name: string | null
  role: string | null
  email_confirmed_at: string | null
  created_at: string
}

export function PlatformAdminPage() {
  const { user, needsPasswordSetup } = useAuth()
  const { household } = useHousehold()
  const { isPlatformAdmin, loading: adminLoading } = usePlatformAdmin()
  const [households, setHouseholds] = useState<HouseholdRow[]>([])
  const [users, setUsers] = useState<UserRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const [userEmail, setUserEmail] = useState('')
  const [userPassword, setUserPassword] = useState('')
  const [userDisplayName, setUserDisplayName] = useState('')
  const [userHouseholdId, setUserHouseholdId] = useState<string>('none')
  const [userRole, setUserRole] = useState<'owner' | 'member'>('member')
  const [creatingUser, setCreatingUser] = useState(false)

  const [householdName, setHouseholdName] = useState('')
  const [ownerEmail, setOwnerEmail] = useState('')
  const [creatingHousehold, setCreatingHousehold] = useState(false)

  const [userToDelete, setUserToDelete] = useState<UserRow | null>(null)
  const [deletingUser, setDeletingUser] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)

    const [householdsRes, usersRes] = await Promise.all([
      supabase.rpc('platform_admin_list_households'),
      supabase.rpc('platform_admin_list_users'),
    ])

    if (householdsRes.error) {
      setError(householdsRes.error.message)
    } else {
      setHouseholds((householdsRes.data ?? []) as HouseholdRow[])
    }

    if (usersRes.error) {
      setError(usersRes.error.message)
    } else {
      setUsers((usersRes.data ?? []) as UserRow[])
    }

    setLoading(false)
  }, [])

  useEffect(() => {
    if (isPlatformAdmin) {
      void loadData()
    }
  }, [isPlatformAdmin, loadData])

  if (adminLoading) return <LoadingSpinner />
  if (!user) return <Navigate to="/login" replace />
  if (needsPasswordSetup) return <Navigate to="/set-password" replace />
  if (!isPlatformAdmin) return <Navigate to="/pantry" replace />

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreatingUser(true)
    setError(null)
    setSuccess(null)

    const { data, error: fnError } = await supabase.functions.invoke('platform-admin-create-user', {
      body: {
        email: userEmail.trim(),
        password: userPassword,
        display_name: userDisplayName.trim() || undefined,
        household_id: userHouseholdId === 'none' ? undefined : userHouseholdId,
        role: userRole,
      },
    })

    if (fnError) {
      setError(
        fnError.message.includes('Failed to send a request to the Edge Function')
          ? 'User creation requires the platform-admin-create-user Edge Function. Deploy it from supabase/functions (see README).'
          : fnError.message,
      )
      setCreatingUser(false)
      return
    }

    if (data?.error) {
      setError(data.error)
      setCreatingUser(false)
      return
    }

    setSuccess(
      data?.invited
        ? `Invite sent to ${userEmail.trim()}. They will set a password via email.`
        : `User ${userEmail.trim()} created successfully.`,
    )
    setUserEmail('')
    setUserPassword('')
    setUserDisplayName('')
    setUserHouseholdId('none')
    setUserRole('member')
    await loadData()
    setCreatingUser(false)
  }

  const handleCreateHousehold = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreatingHousehold(true)
    setError(null)
    setSuccess(null)

    const { data, error: rpcError } = await supabase.rpc('platform_admin_create_household', {
      p_name: householdName.trim(),
      p_owner_email: ownerEmail.trim(),
    })

    if (rpcError) {
      setError(rpcError.message)
      setCreatingHousehold(false)
      return
    }

    const row = Array.isArray(data) ? data[0] : data
    setSuccess(
      `Household "${householdName.trim()}" created. Invite code: ${row?.invite_code ?? '—'}`,
    )
    setHouseholdName('')
    setOwnerEmail('')
    await loadData()
    setCreatingHousehold(false)
  }

  const handleDeleteUser = async () => {
    if (!userToDelete) return
    setDeletingUser(true)
    setError(null)
    setSuccess(null)

    const { data, error: fnError } = await supabase.functions.invoke('platform-admin-delete-user', {
      body: { user_id: userToDelete.user_id },
    })

    if (fnError) {
      setError(
        fnError.message.includes('Failed to send a request to the Edge Function')
          ? 'User deletion requires the platform-admin-delete-user Edge Function. Deploy it from supabase/functions (see README).'
          : fnError.message,
      )
      setDeletingUser(false)
      return
    }

    if (data?.error) {
      setError(data.error)
      setDeletingUser(false)
      return
    }

    setSuccess(`User ${userToDelete.email} deleted.`)
    setUserToDelete(null)
    await loadData()
    setDeletingUser(false)
  }

  if (loading) return <LoadingSpinner />

  return (
    <div className="min-h-dvh bg-background safe-top safe-bottom">
      <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-lg items-center gap-3 px-4 py-3">
          <Button variant="ghost" size="icon" asChild>
            <Link to={household ? '/pantry' : '/household'} title="Back to app">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <h1 className="text-base font-semibold">Platform Admin</h1>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-lg space-y-6 px-4 py-6">
        {error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
            <button type="button" className="ml-2 underline" onClick={() => setError(null)}>
              Dismiss
            </button>
          </div>
        )}

        {success && (
          <div className="rounded-lg border border-primary/30 bg-primary/10 px-4 py-3 text-sm">
            {success}
            <button type="button" className="ml-2 underline" onClick={() => setSuccess(null)}>
              Dismiss
            </button>
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <UserPlus className="h-4 w-4" />
              Add user
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={(e) => void handleCreateUser(e)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="user-email">Email</Label>
                <Input
                  id="user-email"
                  type="email"
                  value={userEmail}
                  onChange={(e) => setUserEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="user-password">Password (optional)</Label>
                <Input
                  id="user-password"
                  type="password"
                  value={userPassword}
                  onChange={(e) => setUserPassword(e.target.value)}
                  minLength={6}
                  placeholder="Leave blank to send invite email"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="user-display-name">Display name</Label>
                <Input
                  id="user-display-name"
                  value={userDisplayName}
                  onChange={(e) => setUserDisplayName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Assign to household (optional)</Label>
                <Select value={userHouseholdId} onValueChange={setUserHouseholdId}>
                  <SelectTrigger>
                    <SelectValue placeholder="No household" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No household</SelectItem>
                    {households.map((h) => (
                      <SelectItem key={h.id} value={h.id}>
                        {h.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {userHouseholdId !== 'none' && (
                <div className="space-y-2">
                  <Label>Role</Label>
                  <Select value={userRole} onValueChange={(v) => setUserRole(v as 'owner' | 'member')}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="member">Member</SelectItem>
                      <SelectItem value="owner">Owner</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
              <Button type="submit" className="w-full" disabled={creatingUser}>
                {creatingUser ? 'Creating…' : 'Create user'}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Building2 className="h-4 w-4" />
              Add household
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={(e) => void handleCreateHousehold(e)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="household-name">Household name</Label>
                <Input
                  id="household-name"
                  value={householdName}
                  onChange={(e) => setHouseholdName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="owner-email">Owner email</Label>
                <Input
                  id="owner-email"
                  type="email"
                  value={ownerEmail}
                  onChange={(e) => setOwnerEmail(e.target.value)}
                  placeholder="Existing user email"
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={creatingHousehold}>
                {creatingHousehold ? 'Creating…' : 'Create household'}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="h-4 w-4" />
              All users ({users.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ul className="divide-y">
              {users.map((u) => {
                const isSelf = u.user_id === user?.id
                return (
                  <li key={u.user_id} className="flex items-start gap-3 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">{u.display_name ?? u.email}</p>
                      <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                      <div className="mt-1 flex flex-wrap gap-2">
                        {u.household_name ? (
                          <Badge variant="secondary">{u.household_name}</Badge>
                        ) : (
                          <Badge variant="outline">No household</Badge>
                        )}
                        {!u.email_confirmed_at && <Badge variant="outline">Unconfirmed</Badge>}
                        {isSelf && <Badge variant="outline">You</Badge>}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="shrink-0 text-destructive hover:text-destructive"
                      title={isSelf ? 'You cannot delete your own account' : 'Delete user'}
                      disabled={isSelf}
                      onClick={() => setUserToDelete(u)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </li>
                )
              })}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Building2 className="h-4 w-4" />
              All households ({households.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ul className="divide-y">
              {households.map((h) => (
                <li key={h.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{h.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {h.member_count} member{h.member_count === 1 ? '' : 's'}
                    </p>
                  </div>
                  <span className="font-mono text-sm font-bold tracking-widest text-primary">
                    {h.invite_code}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </main>

      <Dialog open={!!userToDelete} onOpenChange={(open) => !open && setUserToDelete(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete user?</DialogTitle>
            <DialogDescription>
              {userToDelete && (
                <>
                  This will permanently delete <strong>{userToDelete.email}</strong> and remove
                  them from their household. This cannot be undone.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              disabled={deletingUser}
              onClick={() => setUserToDelete(null)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              className="flex-1"
              disabled={deletingUser}
              onClick={() => void handleDeleteUser()}
            >
              {deletingUser ? 'Deleting…' : 'Delete user'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
