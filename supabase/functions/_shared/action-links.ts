const FALLBACK_DASHBOARD_URL = 'https://dashboard-keprojects.vercel.app'
const FALLBACK_ACTION_LINK_TTL_MS = 14 * 24 * 60 * 60 * 1000

const encoder = new TextEncoder()

function toPositiveInteger(value: string | null): number | null {
  if (!value) return null;
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) return null
  return Math.floor(parsed)
}

function hexFromHash(hash: ArrayBuffer): string {
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export function getDashboardUrl(): string {
  const envUrl = Deno.env.get('DASHBOARD_URL')
    || Deno.env.get('NEXT_PUBLIC_SITE_URL')
    || Deno.env.get('SITE_URL')
    || Deno.env.get('NEXT_PUBLIC_APP_URL')
  return (envUrl || FALLBACK_DASHBOARD_URL).replace(/\/$/, '')
}

export function getActionLinkTtlMs(): number {
  return toPositiveInteger(Deno.env.get('ACTION_LINK_TTL_MS')) || FALLBACK_ACTION_LINK_TTL_MS
}

export async function generateSignedActionToken(params: {
  action: string
  email: string
  day: string
  extra?: string
  issuedAt?: string
  expiresAt?: string
}): Promise<string> {
  const secret = Deno.env.get('ACTION_LINK_SECRET')
  if (!secret) {
    throw new Error('ACTION_LINK_SECRET is required for signed action links')
  }

  const issuedAt = params.issuedAt || String(Date.now())
  const issuedAtMs = toPositiveInteger(issuedAt) || Date.now()
  const expiresAt = params.expiresAt || String(issuedAtMs + getActionLinkTtlMs())

  const tokenPayload = [
    `action=${encodeURIComponent(params.action)}`,
    `email=${encodeURIComponent(params.email.toLowerCase())}`,
    `day=${encodeURIComponent(params.day)}`,
    `extra=${encodeURIComponent(params.extra || '')}`,
    `iat=${encodeURIComponent(issuedAt)}`,
    `exp=${encodeURIComponent(expiresAt)}`,
  ].join('&')

  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )

  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(tokenPayload))
  return `${tokenPayload}|${hexFromHash(signature)}`
}

export async function buildCompleteActionUrl(email: string, day: number | string): Promise<string> {
  const url = getDashboardUrl()
  const token = await generateSignedActionToken({
    action: 'complete',
    email,
    day: String(day),
  })
  const params = new URLSearchParams({
    email,
    day: String(day),
    token,
  })
  return `${url}/api/complete?${params}`
}

export async function buildRelearnActionUrl(
  email: string,
  day: number | string,
  word: string,
  meaning: string
): Promise<string> {
  const url = getDashboardUrl()
  const token = await generateSignedActionToken({
    action: 'relearn',
    email,
    day: String(day),
    extra: word,
  })
  const params = new URLSearchParams({
    email,
    day: String(day),
    word,
    meaning,
    token,
  })
  return `${url}/api/relearn?${params}`
}
