/** Auth link type from Supabase email invite / password-recovery URLs. */
export function getAuthLinkType(): 'invite' | 'recovery' | null {
  const hash = new URLSearchParams(window.location.hash.slice(1))
  const query = new URLSearchParams(window.location.search)
  const type = hash.get('type') ?? query.get('type')
  if (type === 'invite' || type === 'recovery') return type
  return null
}

export function userNeedsPasswordSetup(
  user: { user_metadata?: Record<string, unknown> } | null | undefined,
): boolean {
  return user?.user_metadata?.must_set_password === true
}
