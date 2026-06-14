import { supabase } from '@/lib/supabase'

type FunctionErrorPayload = {
  error?: string
  message?: string
  msg?: string
}

function extractPayloadMessage(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null
  const record = payload as FunctionErrorPayload
  for (const key of ['error', 'message', 'msg'] as const) {
    const value = record[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return null
}

export async function invokeEdgeFunction<T>(
  functionName: string,
  body: Record<string, unknown>,
): Promise<{ data: T | null; error: string | null }> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

  if (!supabaseUrl || !anonKey) {
    return { data: null, error: 'Supabase is not configured.' }
  }

  const {
    data: { session },
  } = await supabase.auth.getSession()

  const accessToken = session?.access_token ?? anonKey

  let response: Response
  try {
    response = await fetch(`${supabaseUrl}/functions/v1/${functionName}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
        apikey: anonKey,
      },
      body: JSON.stringify(body),
    })
  } catch (fetchError) {
    const message =
      fetchError instanceof Error
        ? fetchError.message
        : 'Failed to send a request to the Edge Function'
    return { data: null, error: message }
  }

  const text = await response.text()
  let payload: unknown = null

  if (text) {
    try {
      payload = JSON.parse(text) as unknown
    } catch {
      payload = text
    }
  }

  if (!response.ok) {
    const message =
      extractPayloadMessage(payload) ??
      (typeof payload === 'string' && payload.trim() ? payload.trim() : null) ??
      `Request failed (${response.status} ${response.statusText})`
    return { data: null, error: message }
  }

  const payloadError = extractPayloadMessage(payload)
  if (payloadError) {
    return { data: null, error: payloadError }
  }

  return { data: payload as T, error: null }
}
