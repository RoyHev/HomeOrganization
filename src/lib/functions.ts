import {
  FunctionsFetchError,
  FunctionsHttpError,
  FunctionsRelayError,
} from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

type FunctionErrorPayload = {
  error?: string
  message?: string
}

async function readFunctionErrorMessage(error: FunctionsHttpError): Promise<string> {
  try {
    const payload = (await error.context.json()) as FunctionErrorPayload
    if (typeof payload.error === 'string' && payload.error.trim()) return payload.error
    if (typeof payload.message === 'string' && payload.message.trim()) return payload.message
  } catch {
    // Response body was not JSON — fall back to generic message below.
  }
  return error.message
}

export async function invokeEdgeFunction<T>(
  functionName: string,
  body: Record<string, unknown>,
): Promise<{ data: T | null; error: string | null }> {
  const { data, error } = await supabase.functions.invoke(functionName, { body })

  if (error instanceof FunctionsHttpError) {
    return { data: null, error: await readFunctionErrorMessage(error) }
  }

  if (error instanceof FunctionsRelayError || error instanceof FunctionsFetchError) {
    return { data: null, error: error.message }
  }

  if (error) {
    return { data: null, error: error.message }
  }

  const result = data as (T & FunctionErrorPayload) | null
  if (result && typeof result.error === 'string' && result.error.trim()) {
    return { data: null, error: result.error }
  }

  return { data: result as T | null, error: null }
}
