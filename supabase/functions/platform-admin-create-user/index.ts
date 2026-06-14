import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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
      return new Response(JSON.stringify({ error: 'Missing authorization' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    })

    const {
      data: { user: caller },
      error: userError,
    } = await userClient.auth.getUser()

    if (userError || !caller) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: isAdmin, error: adminError } = await userClient.rpc('is_platform_admin')
    if (adminError || !isAdmin) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const body = await req.json()
    const email = String(body.email ?? '').trim().toLowerCase()
    const password = String(body.password ?? '')
    const displayName = String(body.display_name ?? '').trim()
    const householdId = body.household_id ? String(body.household_id) : null
    const role = body.role === 'owner' ? 'owner' : 'member'

    if (!email) {
      return new Response(JSON.stringify({ error: 'Email is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (password.length > 0 && password.length < 6) {
      return new Response(JSON.stringify({ error: 'Password must be at least 6 characters' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey)

    const appUrl = (Deno.env.get('APP_URL') ?? Deno.env.get('SITE_URL') ?? 'http://localhost:5173').replace(
      /\/$/,
      '',
    )
    const setPasswordUrl = `${appUrl}/set-password`

    async function findUserByEmail(targetEmail: string) {
      let page = 1
      while (page <= 10) {
        const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage: 1000 })
        if (error || !data?.users?.length) return null
        const match = data.users.find((u) => u.email?.toLowerCase() === targetEmail)
        if (match) return match
        if (data.users.length < 1000) break
        page++
      }
      return null
    }

    async function removeExistingUser(targetEmail: string) {
      const existing = await findUserByEmail(targetEmail)
      if (!existing) return null
      const { error } = await adminClient.auth.admin.deleteUser(existing.id)
      if (error) return error.message
      return null
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

    let userId: string

    if (password.length > 0) {
      const existing = await findUserByEmail(email)
      if (existing) {
        const { data, error } = await adminClient.auth.admin.updateUserById(existing.id, {
          password,
          email_confirm: true,
          user_metadata: {
            ...(existing.user_metadata ?? {}),
            ...(displayName ? { display_name: displayName } : {}),
            must_set_password: false,
          },
        })

        if (error || !data.user) {
          return new Response(
            JSON.stringify({ error: error?.message ?? 'Failed to update existing user' }),
            {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            },
          )
        }

        userId = data.user.id
      } else {
        const { data, error } = await adminClient.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: displayName ? { display_name: displayName } : undefined,
        })

        if (error || !data.user) {
          if (!isDuplicateEmailError(error?.message)) {
            return new Response(JSON.stringify({ error: error?.message ?? 'Failed to create user' }), {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            })
          }

          const cleanupError = await removeExistingUser(email)
          if (cleanupError) {
            return new Response(JSON.stringify({ error: cleanupError }), {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            })
          }

          const retry = await adminClient.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: displayName ? { display_name: displayName } : undefined,
          })

          if (retry.error || !retry.data.user) {
            return new Response(
              JSON.stringify({ error: retry.error?.message ?? error?.message ?? 'Failed to create user' }),
              {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              },
            )
          }

          userId = retry.data.user.id
        } else {
          userId = data.user.id
        }
      }
    } else {
      const cleanupError = await removeExistingUser(email)
      if (cleanupError) {
        return new Response(JSON.stringify({ error: cleanupError }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const { data, error } = await adminClient.auth.admin.inviteUserByEmail(email, {
        redirectTo: setPasswordUrl,
        data: {
          ...(displayName ? { display_name: displayName } : {}),
          must_set_password: true,
        },
      })

      if (error || !data.user) {
        return new Response(JSON.stringify({ error: error?.message ?? 'Failed to invite user' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      userId = data.user.id
    }

    if (householdId) {
      const { error: memberError } = await userClient.rpc('platform_admin_add_user_to_household', {
        p_household_id: householdId,
        p_email: email,
        p_role: role,
        p_display_name: displayName || null,
      })

      if (memberError) {
        return new Response(
          JSON.stringify({
            error: memberError.message,
            user_id: userId,
            partial: true,
          }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          },
        )
      }
    }

    return new Response(
      JSON.stringify({
        user_id: userId,
        invited: password.length === 0,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected error'
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
