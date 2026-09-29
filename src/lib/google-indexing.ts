import crypto from 'crypto'

// Google's Indexing API is officially supported for pages carrying JobPosting structured data:
// notifying it on publish/delete gets a role into (or out of) Google for Jobs within hours
// instead of waiting for a crawl. Auth is a service account whose client_email has been added
// as an Owner of the site in Google Search Console.
// https://developers.google.com/search/apis/indexing-api/v3/quickstart

const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const PUBLISH_URL = 'https://indexing.googleapis.com/v3/urlNotifications:publish'
const SCOPE = 'https://www.googleapis.com/auth/indexing'

export type ServiceAccount = { client_email: string; private_key: string }
export type IndexingNotification = 'URL_UPDATED' | 'URL_DELETED'
export type IndexingResult = { status: 'notified' | 'skipped' | 'failed'; message: string }

/** Reads GOOGLE_INDEXING_CREDENTIALS: the service account's JSON key file contents. */
export function readServiceAccount(raw = process.env.GOOGLE_INDEXING_CREDENTIALS): ServiceAccount | null {
  if (!raw?.trim()) return null
  try {
    const parsed = JSON.parse(raw) as Partial<ServiceAccount>
    if (!parsed.client_email || !parsed.private_key) return null
    // Env UIs often flatten the PEM onto one line with literal "\n" separators.
    return { client_email: parsed.client_email, private_key: parsed.private_key.replace(/\\n/g, '\n') }
  } catch {
    return null
  }
}

export function isGoogleIndexingConfigured() {
  return readServiceAccount() !== null
}

/** Self-signed JWT exchanged for an access token (OAuth 2.0 service-account flow). */
export function createJwtAssertion(account: ServiceAccount, nowSeconds = Math.floor(Date.now() / 1000)) {
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url')
  const unsigned = `${encode({ alg: 'RS256', typ: 'JWT' })}.${encode({
    iss: account.client_email,
    scope: SCOPE,
    aud: TOKEN_URL,
    iat: nowSeconds,
    exp: nowSeconds + 3600,
  })}`
  const signature = crypto.createSign('RSA-SHA256').update(unsigned).sign(account.private_key).toString('base64url')
  return `${unsigned}.${signature}`
}

export async function notifyGoogleIndexing(url: string, type: IndexingNotification): Promise<IndexingResult> {
  const account = readServiceAccount()
  if (!account) return { status: 'skipped', message: 'Google Indexing API is not configured (GOOGLE_INDEXING_CREDENTIALS).' }

  try {
    const tokenResponse = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: createJwtAssertion(account),
      }),
      signal: AbortSignal.timeout(15000),
    })
    if (!tokenResponse.ok) {
      const detail = await tokenResponse.text().catch(() => '')
      return { status: 'failed', message: `Google rejected the service account (${tokenResponse.status}). ${detail.slice(0, 200)}`.trim() }
    }
    const { access_token } = (await tokenResponse.json()) as { access_token: string }

    const response = await fetch(PUBLISH_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${access_token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, type }),
      signal: AbortSignal.timeout(15000),
    })
    if (!response.ok) {
      const detail = await response.text().catch(() => '')
      const hint = response.status === 403
        ? ' Add the service account email as an Owner of the site in Google Search Console.'
        : ''
      return { status: 'failed', message: `Google Indexing API error (${response.status}).${hint} ${detail.slice(0, 200)}`.trim() }
    }
    return {
      status: 'notified',
      message: type === 'URL_UPDATED' ? 'Google notified; the role should appear in Google for Jobs within hours.' : 'Google notified that the role was removed.',
    }
  } catch (error) {
    return { status: 'failed', message: `Google Indexing API unreachable: ${error instanceof Error ? error.message : 'unknown error'}` }
  }
}
