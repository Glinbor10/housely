export type TricountResult =
  | { ok: true; url: string | null }
  | { ok: false; reason: 'not-https' | 'not-tricount' | 'too-long' }

// Mirrors the Firestore rules (firestore/firestore.rules).
const MAX_LENGTH = 300

// Accepts https links on tricount.com or its subdomains and nothing else: the link is opened by every
// flatmate, so a look-alike host (tricount.com.evil.com), credentials or a custom port are rejected.
export const parseTricountUrl = (input: string): TricountResult => {
  const value = input.trim()
  if (value === '') return { ok: true, url: null }
  if (value.length > MAX_LENGTH) return { ok: false, reason: 'too-long' }

  let parsed: URL
  try {
    parsed = new URL(value)
  } catch {
    return { ok: false, reason: 'not-https' }
  }
  if (parsed.protocol !== 'https:') return { ok: false, reason: 'not-https' }

  const isTricountHost =
    parsed.hostname === 'tricount.com' || parsed.hostname.endsWith('.tricount.com')
  const hasCredentialsOrPort =
    parsed.username !== '' || parsed.password !== '' || parsed.port !== ''
  return isTricountHost && !hasCredentialsOrPort
    ? { ok: true, url: value }
    : { ok: false, reason: 'not-tricount' }
}
