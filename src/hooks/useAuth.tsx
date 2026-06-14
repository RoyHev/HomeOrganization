import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { User, Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { getAuthLinkType, userNeedsPasswordSetup } from '@/lib/auth-utils'

export interface AuthErrorResult {
  message: string
  code: string | null
}

interface AuthContextValue {
  user: User | null
  session: Session | null
  loading: boolean
  needsPasswordSetup: boolean
  signUp: (email: string, password: string, displayName: string) => Promise<AuthErrorResult | null>
  signIn: (email: string, password: string) => Promise<AuthErrorResult | null>
  resetPassword: (email: string) => Promise<AuthErrorResult | null>
  updatePassword: (password: string) => Promise<AuthErrorResult | null>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

function initialPasswordSetupRequired(): boolean {
  const linkType = getAuthLinkType()
  return linkType === 'invite' || linkType === 'recovery'
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [needsPasswordSetup, setNeedsPasswordSetup] = useState(initialPasswordSetupRequired)

  const syncPasswordSetup = useCallback((nextUser: User | null) => {
    const linkType = getAuthLinkType()
    if (linkType === 'invite' || linkType === 'recovery') {
      setNeedsPasswordSetup(true)
      return
    }
    setNeedsPasswordSetup(userNeedsPasswordSetup(nextUser))
  }, [])

  useEffect(() => {
    void supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s)
      setUser(s?.user ?? null)
      syncPasswordSetup(s?.user ?? null)
      setLoading(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s)
      setUser(s?.user ?? null)
      setLoading(false)

      if (event === 'PASSWORD_RECOVERY') {
        setNeedsPasswordSetup(true)
        return
      }

      if (event === 'SIGNED_IN' && s?.user) {
        syncPasswordSetup(s.user)
        return
      }

      if (event === 'USER_UPDATED' && s?.user) {
        if (!userNeedsPasswordSetup(s.user)) {
          setNeedsPasswordSetup(false)
        }
      }
    })

    return () => subscription.unsubscribe()
  }, [syncPasswordSetup])

  const signUp = useCallback(
    async (email: string, password: string, displayName: string) => {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { display_name: displayName } },
      })
      if (!error) return null
      return { message: error.message, code: error.code ?? null }
    },
    [],
  )

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (!error) return null
    return { message: error.message, code: error.code ?? null }
  }, [])

  const resetPassword = useCallback(async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/set-password`,
    })
    if (!error) return null
    return { message: error.message, code: error.code ?? null }
  }, [])

  const updatePassword = useCallback(async (password: string) => {
    const { error } = await supabase.auth.updateUser({
      password,
      data: { must_set_password: false },
    })
    if (!error) {
      setNeedsPasswordSetup(false)
      return null
    }
    return { message: error.message, code: error.code ?? null }
  }, [])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
  }, [])

  const value = useMemo(
    () => ({
      user,
      session,
      loading,
      needsPasswordSetup,
      signUp,
      signIn,
      resetPassword,
      updatePassword,
      signOut,
    }),
    [user, session, loading, needsPasswordSetup, signUp, signIn, resetPassword, updatePassword, signOut],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
