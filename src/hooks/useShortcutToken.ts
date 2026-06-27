import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export function useShortcutToken() {
  const [hasToken, setHasToken] = useState(false)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    const { data, error } = await supabase.rpc('has_shortcut_token')
    if (!error) setHasToken(!!data)
    setLoading(false)
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const createToken = useCallback(async () => {
    const { data, error } = await supabase.rpc('create_shortcut_token')
    if (error) return { token: null as string | null, error: error.message }
    await refresh()
    return { token: data as string, error: null as string | null }
  }, [refresh])

  const revokeToken = useCallback(async () => {
    const { error } = await supabase.rpc('revoke_shortcut_token')
    if (error) return { error: error.message }
    setHasToken(false)
    return { error: null as string | null }
  }, [])

  return { hasToken, loading, createToken, revokeToken, refresh }
}

export function getShortcutApiUrl(): string {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined
  if (!supabaseUrl) return ''
  return `${supabaseUrl}/functions/v1/add-shopping-item`
}

export function getSupabaseAnonKey(): string {
  return (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ?? ''
}
