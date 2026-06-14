const PASSWORD_SETUP_KEY = 'auth:pending-password-setup'

/** Auth link type from Supabase email invite / password-recovery URLs. */
export function getAuthLinkType(): 'invite' | 'recovery' | null {
  const hash = new URLSearchParams(window.location.hash.slice(1))
  const query = new URLSearchParams(window.location.search)
  const type = hash.get('type') ?? query.get('type')
  if (type === 'invite' || type === 'recovery') return type
  return null
}

/** Persist invite/recovery before Supabase clears the URL hash. */
export function captureAuthLinkType(): void {
  const type = getAuthLinkType()
  if (type === 'invite' || type === 'recovery') {
    sessionStorage.setItem(PASSWORD_SETUP_KEY, type)
  }
}

export function getPendingPasswordSetup(): 'invite' | 'recovery' | null {
  const type = getAuthLinkType()
  if (type === 'invite' || type === 'recovery') {
    sessionStorage.setItem(PASSWORD_SETUP_KEY, type)
    return type
  }

  const stored = sessionStorage.getItem(PASSWORD_SETUP_KEY)
  if (stored === 'invite' || stored === 'recovery') return stored
  return null
}

export function clearPendingPasswordSetup(): void {
  sessionStorage.removeItem(PASSWORD_SETUP_KEY)
}

export function userNeedsPasswordSetup(
  user: { user_metadata?: Record<string, unknown> } | null | undefined,
): boolean {
  if (getPendingPasswordSetup()) return true
  return user?.user_metadata?.must_set_password === true
}

if (typeof window !== 'undefined') {
  captureAuthLinkType()
}
