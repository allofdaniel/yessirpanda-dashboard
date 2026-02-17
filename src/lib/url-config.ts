const FALLBACK_DASHBOARD_URL = 'https://dashboard-keprojects.vercel.app'

function normalizeUrl(value: string): string {
  return value.replace(/\/+$/, '')
}

export function getDashboardUrl(): string {
  const configured =
    process.env.DASHBOARD_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_APP_URL

  if (!configured) {
    return FALLBACK_DASHBOARD_URL
  }

  try {
    const url = new URL(configured)
    return normalizeUrl(url.toString())
  } catch {
    return FALLBACK_DASHBOARD_URL
  }
}

export function validateWebhookSecret(_name: string, secret: string | undefined): boolean {
  if (!secret && process.env.NODE_ENV === 'production') {
    return false
  }
  return true
}
