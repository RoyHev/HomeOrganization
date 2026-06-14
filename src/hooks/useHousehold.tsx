import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { supabase } from '@/lib/supabase'
import { generateInviteCode } from '@/lib/utils'
import { useAuth } from '@/hooks/useAuth'
import type { Household, HouseholdMember, HouseholdMemberWithHousehold } from '@/types/database'

interface HouseholdContextValue {
  household: Household | null
  membership: HouseholdMember | null
  loading: boolean
  createHousehold: (name: string) => Promise<{ error: string | null }>
  joinHousehold: (inviteCode: string) => Promise<{ error: string | null }>
  refresh: () => Promise<void>
}

const HouseholdContext = createContext<HouseholdContextValue | null>(null)

export function HouseholdProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [household, setHousehold] = useState<Household | null>(null)
  const [membership, setMembership] = useState<HouseholdMember | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchHousehold = useCallback(async () => {
    if (!user) {
      setHousehold(null)
      setMembership(null)
      setLoading(false)
      return
    }

    setLoading(true)
    const { data: member, error } = await supabase
      .from('household_members')
      .select('*, households(*)')
      .eq('user_id', user.id)
      .maybeSingle()

    if (error || !member) {
      setHousehold(null)
      setMembership(null)
    } else {
      const row = member as HouseholdMemberWithHousehold
      setMembership({
        id: row.id,
        household_id: row.household_id,
        user_id: row.user_id,
        role: row.role,
        display_name: row.display_name,
        created_at: row.created_at,
      })
      setHousehold(row.households)
    }
    setLoading(false)
  }, [user])

  useEffect(() => {
    void fetchHousehold()
  }, [fetchHousehold])

  const createHousehold = useCallback(
    async (name: string) => {
      if (!user) return { error: 'Not authenticated' }

      const { data: existingMember } = await supabase
        .from('household_members')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle()

      if (existingMember) {
        return { error: 'You are already in a household' }
      }

      const inviteCode = generateInviteCode()
      const { data: newHousehold, error: householdError } = await supabase
        .from('households')
        .insert({ name, invite_code: inviteCode })
        .select()
        .single()

      if (householdError || !newHousehold) {
        return { error: householdError?.message ?? 'Failed to create household' }
      }

      const displayName =
        (user.user_metadata?.display_name as string | undefined) ?? user.email?.split('@')[0] ?? 'Member'

      const { error: memberError } = await supabase.from('household_members').insert({
        household_id: newHousehold.id,
        user_id: user.id,
        role: 'owner',
        display_name: displayName,
      })

      if (memberError) {
        return { error: memberError.message }
      }

      await supabase.rpc('seed_household_categories', { p_household_id: newHousehold.id })

      await fetchHousehold()
      return { error: null }
    },
    [user, fetchHousehold],
  )

  const joinHousehold = useCallback(
    async (inviteCode: string) => {
      if (!user) return { error: 'Not authenticated' }

      const { data: existingMember } = await supabase
        .from('household_members')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle()

      if (existingMember) {
        return { error: 'You are already in a household' }
      }

      const { data: householdId, error: lookupError } = await supabase.rpc(
        'lookup_household_by_invite',
        { p_invite_code: inviteCode.trim().toUpperCase() },
      )

      if (lookupError || !householdId) {
        return { error: 'Invalid invite code' }
      }

      const displayName =
        (user.user_metadata?.display_name as string | undefined) ?? user.email?.split('@')[0] ?? 'Member'

      const { error: memberError } = await supabase.from('household_members').insert({
        household_id: householdId,
        user_id: user.id,
        role: 'member',
        display_name: displayName,
      })

      if (memberError) {
        return { error: memberError.message.includes('duplicate') ? 'Already in a household' : memberError.message }
      }

      await fetchHousehold()
      return { error: null }
    },
    [user, fetchHousehold],
  )

  const value = useMemo(
    () => ({
      household,
      membership,
      loading,
      createHousehold,
      joinHousehold,
      refresh: fetchHousehold,
    }),
    [household, membership, loading, createHousehold, joinHousehold, fetchHousehold],
  )

  return <HouseholdContext.Provider value={value}>{children}</HouseholdContext.Provider>
}

export function useHousehold() {
  const ctx = useContext(HouseholdContext)
  if (!ctx) throw new Error('useHousehold must be used within HouseholdProvider')
  return ctx
}
