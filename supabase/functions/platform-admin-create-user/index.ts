import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function isDuplicateEmailError(message: string | undefined): boolean {
  if (!message) return false
  const lower = message.toLowerCase()
  return (
    lower.includes('already') ||
    lower.includes('registered') ||
    lower.includes('exists') ||
    lower.includes('duplicate')
  )
}

function asMetadataRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }
  return {}
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return jsonResponse({ error: 'Missing authorization' }, 401)
    }

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    })

    const {
      data: { user: caller },
      error: userError,
    } = await userClient.auth.getUser()

    if (userError || !caller) {
      return jsonResponse({ error: 'Unauthorized' }, 401)
    }

    const { data: isAdmin, error: adminError } = await userClient.rpc('is_platform_admin')
    if (adminError || !isAdmin) {
      return jsonResponse({ error: 'Forbidden' }, 403)
    }

    const body = await req.json()
    const email = String(body.email ?? '').trim().toLowerCase()
    const password = String(body.password ?? '')
    const displayName = String(body.display_name ?? '').trim()
    const householdId = body.household_id ? String(body.household_id) : null
    const role = body.role === 'owner' ? 'owner' : 'member'

    if (!email) {
      return jsonResponse({ error: 'Email is required' }, 400)
    }

    if (password.length > 0 && password.length < 6) {
      return jsonResponse({ error: 'Password must be at least 6 characters' }, 400)
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey)

    const appUrl = (Deno.env.get('APP_URL') ?? Deno.env.get('SITE_URL') ?? 'http://localhost:5173').replace(
      /\/$/,
      '',
    )
    const setPasswordUrl = `${appUrl}/set-password`

    async function findUserByEmail(targetEmail: string) {
      let page = 1
      while (page <= 20) {
        const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage: 200 })
        if (error) return { user: null, error: error.message }
        const users = data?.users ?? []
        const match = users.find((u) => u.email?.toLowerCase() === targetEmail)
        if (match) return { user: match, error: null }
        if (users.length < 200) break
        page++
      }
      return { user: null, error: null }
    }

    async function deleteUserByEmail(targetEmail: string) {
      const { user, error: lookupError } = await findUserByEmail(targetEmail)
      if (lookupError) return lookupError
      if (!user) return null
      const { error } = await adminClient.auth.admin.deleteUser(user.id)
      return error?.message ?? null
    }

    let userId: string

    if (password.length > 0) {
      const { user: existing } = await findUserByEmail(email)

      if (existing) {
        const { data, error } = await adminClient.auth.admin.updateUserById(existing.id, {
          password,
          email_confirm: true,
          user_metadata: {
            ...asMetadataRecord(existing.user_metadata),
            ...(displayName ? { display_name: displayName } : {}),
            must_set_password: false,
          },
        })

        if (error || !data.user) {
          return jsonResponse({ error: error?.message ?? 'Failed to update existing user' }, 400)
        }

        userId = data.user.id
      } else {
        let { data, error } = await adminClient.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: displayName ? { display_name: displayName } : undefined,
        })

        if ((error || !data.user) && isDuplicateEmailError(error?.message)) {
          const cleanupError = await deleteUserByEmail(email)
          if (cleanupError) {
            return jsonResponse({ error: cleanupError }, 400)
          }

          ;({ data, error } = await adminClient.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: displayName ? { display_name: displayName } : undefined,
          }))
        }

        if (error || !data?.user) {
          return jsonResponse({ error: error?.message ?? 'Failed to create user' }, 400)
        }

        userId = data.user.id
      }
    } else {
      let { data, error } = await adminClient.auth.admin.inviteUserByEmail(email, {
        redirectTo: setPasswordUrl,
        data: {
          ...(displayName ? { display_name: displayName } : {}),
          must_set_password: true,
        },
      })

      if ((error || !data.user) && isDuplicateEmailError(error?.message)) {
        const cleanupError = await deleteUserByEmail(email)
        if (cleanupError) {
          return jsonResponse({ error: cleanupError }, 400)
        }

        ;({ data, error } = await adminClient.auth.admin.inviteUserByEmail(email, {
          redirectTo: setPasswordUrl,
          data: {
            ...(displayName ? { display_name: displayName } : {}),
            must_set_password: true,
          },
        }))
      }

      if (error || !data?.user) {
        return jsonResponse({ error: error?.message ?? 'Failed to invite user' }, 400)
      }

      userId = data.user.id

      await adminClient.auth.admin.updateUserById(userId, {
        user_metadata: {
          must_set_password: true,
          ...(displayName ? { display_name: displayName } : {}),
        },
      })
    }

    if (householdId) {
      const { error: memberError } = await userClient.rpc('platform_admin_add_user_to_household', {
        p_household_id: householdId,
        p_email: email,
        p_role: role,
        p_display_name: displayName || null,
      })

      if (memberError) {
        return jsonResponse(
          {
            error: memberError.message,
            user_id: userId,
            partial: true,
          },
          400,
        )
      }
    }

    return jsonResponse({
      user_id: userId,
      invited: password.length === 0,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected error'
    return jsonResponse({ error: message }, 500)
  }
})
