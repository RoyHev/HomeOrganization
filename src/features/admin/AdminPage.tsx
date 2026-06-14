import { useCallback, useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import {
  Users,
  Shield,
  Trash2,
  Copy,
  Check,
  RotateCcw,
  ExternalLink,
  Crown,
  UserRound,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { useHousehold } from '@/hooks/useHousehold'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { LoadingSpinner } from '@/components/ui/empty-state'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'

type MemberWithEmail = {
  id: string
  household_id: string
  user_id: string
  role: 'owner' | 'member'
  display_name: string | null
  email: string
  created_at: string
}

export function AdminPage() {
  const { user } = useAuth()
  const { household, membership, refresh: refreshHousehold } = useHousehold()
  const [members, setMembers] = useState<MemberWithEmail[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [codeCopied, setCodeCopied] = useState(false)
  const [linkCopied, setLinkCopied] = useState(false)
  const [regenerating, setRegenerating] = useState(false)
  const [confirmRemove, setConfirmRemove] = useState<MemberWithEmail | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const isOwner = membership?.role === 'owner'

  const fetchMembers = useCallback(async () => {
    setLoading(true)
    const { data, error: err } = await supabase.rpc('get_household_members_with_email')
    if (err) {
      setError(err.message)
    } else {
      setMembers((data ?? []) as MemberWithEmail[])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    void fetchMembers()
  }, [fetchMembers])

  if (!isOwner) return <Navigate to="/pantry" replace />

  const handleCopyCode = async () => {
    if (!household) return
    await navigator.clipboard.writeText(household.invite_code)
    setCodeCopied(true)
    setTimeout(() => setCodeCopied(false), 2000)
  }

  const handleCopyInviteLink = async () => {
    if (!household) return
    const url = `${window.location.origin}/household`
    await navigator.clipboard.writeText(`${url}\nInvite code: ${household.invite_code}`)
    setLinkCopied(true)
    setTimeout(() => setLinkCopied(false), 2000)
  }

  const handleRegenerateCode = async () => {
    setRegenerating(true)
    const { error: err } = await supabase.rpc('regenerate_invite_code')
    if (err) {
      setError(err.message)
    } else {
      await refreshHousehold()
    }
    setRegenerating(false)
  }

  const handleRoleToggle = async (member: MemberWithEmail) => {
    setActionLoading(member.id)
    const newRole = member.role === 'owner' ? 'member' : 'owner'
    const { error: err } = await supabase.rpc('update_member_role', {
      p_member_id: member.id,
      p_new_role: newRole,
    })
    if (err) {
      setError(err.message)
    } else {
      await fetchMembers()
    }
    setActionLoading(null)
  }

  const handleRemove = async (member: MemberWithEmail) => {
    setActionLoading(member.id)
    const { error: err } = await supabase.rpc('remove_household_member', {
      p_member_id: member.id,
    })
    if (err) {
      setError(err.message)
    } else {
      setConfirmRemove(null)
      await fetchMembers()
    }
    setActionLoading(null)
  }

  if (loading) return <LoadingSpinner />

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Shield className="h-5 w-5 text-primary" />
        <h2 className="text-xl font-semibold">Admin</h2>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
          <button className="ml-2 underline" onClick={() => setError(null)}>
            Dismiss
          </button>
        </div>
      )}

      {/* Household info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Household</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-xs text-muted-foreground mb-1">Name</p>
            <p className="font-medium">{household?.name}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Invite code</p>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xl font-bold tracking-[0.3em] text-primary">
                {household?.invite_code}
              </span>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => void handleCopyCode()}
                title="Copy code"
              >
                {codeCopied ? <Check className="h-4 w-4 text-primary" /> : <Copy className="h-4 w-4" />}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => void handleRegenerateCode()}
                disabled={regenerating}
                title="Regenerate code"
              >
                <RotateCcw className={`h-4 w-4 ${regenerating ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>
          <Button variant="outline" size="sm" className="w-full" onClick={() => void handleCopyInviteLink()}>
            {linkCopied ? (
              <>
                <Check className="h-4 w-4" />
                Copied invite message
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" />
                Copy invite message
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Add new user instructions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Adding new members</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <ol className="list-decimal list-inside space-y-2">
            <li>
              Open your Supabase project → <strong className="text-foreground">Authentication → Users</strong> →{' '}
              <strong className="text-foreground">Invite user</strong>
            </li>
            <li>Enter the new member&apos;s email address and send the invite</li>
            <li>They receive an email and click the link to set their password</li>
            <li>
              Share the invite code <strong className="text-foreground font-mono">{household?.invite_code}</strong> with them — they enter it when they log in for the first time
            </li>
          </ol>
          <a
            href="https://supabase.com/dashboard"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-primary text-xs hover:underline mt-1"
          >
            Open Supabase dashboard
            <ExternalLink className="h-3 w-3" />
          </a>
          <div className="mt-3 rounded-lg bg-accent/50 px-3 py-2 text-xs">
            <strong>Tip:</strong> To prevent self-registration, go to Supabase → Authentication → Providers → Email and disable{' '}
            <em>Enable email signups</em>.
          </div>
        </CardContent>
      </Card>

      {/* Members list */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">
              <span className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Members ({members.length})
              </span>
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <ul className="divide-y">
            {members.map((member) => {
              const isSelf = member.user_id === user?.id
              const isLoading = actionLoading === member.id
              return (
                <li key={member.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-accent text-primary">
                    {member.role === 'owner' ? (
                      <Crown className="h-4 w-4" />
                    ) : (
                      <UserRound className="h-4 w-4" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate">
                      {member.display_name ?? member.email}
                      {isSelf && (
                        <span className="ml-1 text-xs text-muted-foreground">(you)</span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">{member.email}</p>
                  </div>
                  <Badge variant={member.role === 'owner' ? 'default' : 'secondary'}>
                    {member.role}
                  </Badge>
                  {!isSelf && (
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={isLoading}
                        onClick={() => void handleRoleToggle(member)}
                        title={member.role === 'owner' ? 'Demote to member' : 'Promote to owner'}
                      >
                        {member.role === 'owner' ? (
                          <UserRound className="h-4 w-4" />
                        ) : (
                          <Crown className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={isLoading}
                        onClick={() => setConfirmRemove(member)}
                        title="Remove from household"
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        </CardContent>
      </Card>

      {/* Confirm remove dialog */}
      <Dialog open={!!confirmRemove} onOpenChange={() => setConfirmRemove(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Remove member?</DialogTitle>
            <DialogDescription>
              {confirmRemove?.display_name ?? confirmRemove?.email} will be removed from the
              household and lose access to all data.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setConfirmRemove(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              className="flex-1"
              disabled={!!actionLoading}
              onClick={() => confirmRemove && void handleRemove(confirmRemove)}
            >
              Remove
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
