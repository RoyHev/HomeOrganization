/**
 * Dry-run test for platform-admin-create-user error handling.
 *
 * Usage:
 *   node scripts/test-create-user.mjs
 *   node scripts/test-create-user.mjs --with-auth EMAIL PASSWORD
 *
 * Without credentials it verifies unauthenticated calls return a readable error.
 * With platform-admin credentials it attempts a real invite for a throwaway email.
 */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

function loadEnv() {
  try {
    const envPath = resolve(process.cwd(), '.env')
    const contents = readFileSync(envPath, 'utf8')
    for (const line of contents.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const idx = trimmed.indexOf('=')
      if (idx === -1) continue
      const key = trimmed.slice(0, idx).trim()
      const value = trimmed.slice(idx + 1).trim()
      if (!process.env[key]) process.env[key] = value
    }
  } catch {
    // .env is optional for explicit env vars.
  }
}

function extractPayloadMessage(payload) {
  if (!payload || typeof payload !== 'object') return null
  for (const key of ['error', 'message', 'msg']) {
    const value = payload[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return null
}

async function invokeCreateUser({ supabaseUrl, anonKey, accessToken, body }) {
  const response = await fetch(`${supabaseUrl}/functions/v1/platform-admin-create-user`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
      apikey: anonKey,
    },
    body: JSON.stringify(body),
  })

  const text = await response.text()
  let payload = null
  if (text) {
    try {
      payload = JSON.parse(text)
    } catch {
      payload = text
    }
  }

  const message =
    extractPayloadMessage(payload) ??
    (typeof payload === 'string' && payload.trim() ? payload.trim() : null) ??
    `Request failed (${response.status} ${response.statusText})`

  return { ok: response.ok, status: response.status, payload, message }
}

async function signIn({ supabaseUrl, anonKey, email, password }) {
  const response = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: anonKey,
    },
    body: JSON.stringify({ email, password }),
  })

  const payload = await response.json()
  if (!response.ok) {
    throw new Error(payload.error_description ?? payload.msg ?? payload.message ?? 'Sign in failed')
  }

  return payload.access_token
}

function printResult(label, result) {
  console.log(`\n${label}`)
  console.log(`  HTTP ${result.status}`)
  console.log(`  Message: ${result.message}`)
  if (result.payload) {
    console.log(`  Payload: ${JSON.stringify(result.payload)}`)
  }
}

loadEnv()

const supabaseUrl = process.env.VITE_SUPABASE_URL
const anonKey = process.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !anonKey) {
  console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env')
  process.exit(1)
}

const args = process.argv.slice(2)
const withAuth = args[0] === '--with-auth'
const adminEmail = withAuth ? args[1] : null
const adminPassword = withAuth ? args[2] : null

const testEmail = `dry-run-${Date.now()}@example.com`

console.log('Testing platform-admin-create-user')

const unauthenticated = await invokeCreateUser({
  supabaseUrl,
  anonKey,
  accessToken: anonKey,
  body: { email: testEmail },
})

printResult('1) Unauthenticated request (expect readable auth error)', unauthenticated)

if (!unauthenticated.message || unauthenticated.message.includes('non-2xx')) {
  console.error('\nFAIL: Unauthenticated call did not return a readable error message.')
  process.exit(1)
}

if (withAuth) {
  if (!adminEmail || !adminPassword) {
    console.error('\nUsage: node scripts/test-create-user.mjs --with-auth EMAIL PASSWORD')
    process.exit(1)
  }

  console.log(`\nSigning in as ${adminEmail}...`)
  const accessToken = await signIn({ supabaseUrl, anonKey, email: adminEmail, password: adminPassword })

  const authenticated = await invokeCreateUser({
    supabaseUrl,
    anonKey,
    accessToken,
    body: {
      email: testEmail,
      display_name: 'Dry Run User',
    },
  })

  printResult('2) Authenticated invite request', authenticated)

  if (!authenticated.ok) {
    console.error('\nFAIL: Authenticated create-user call failed.')
    process.exit(1)
  }

  console.log('\nPASS: Authenticated invite succeeded.')
} else {
  console.log('\nPASS: Error message extraction works for unauthenticated calls.')
  console.log('For a full invite dry run, pass platform-admin credentials:')
  console.log('  node scripts/test-create-user.mjs --with-auth your@email.com your-password')
}
