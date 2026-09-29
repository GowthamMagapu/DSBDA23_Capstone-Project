import { prisma } from '@/lib/prisma'
import { getAppUrl } from '@/lib/app-url'
import { decryptSecret, encryptSecret } from '@/lib/secret-box'
import { createJobAnnouncementText } from '@/lib/job-sharing'

// Each recruiter connects their own LinkedIn account via OAuth 2.0. Posting as the member needs
// the self-serve "Share on LinkedIn" + "Sign In with LinkedIn using OpenID Connect" products
// (scopes: openid profile w_member_social). Posting as a company page additionally needs the
// Community Management API product (w_organization_social) and the member must be a page admin.

const AUTHORIZE_URL = 'https://www.linkedin.com/oauth/v2/authorization'
const TOKEN_URL = 'https://www.linkedin.com/oauth/v2/accessToken'
const USERINFO_URL = 'https://api.linkedin.com/v2/userinfo'
const UGC_POSTS_URL = 'https://api.linkedin.com/v2/ugcPosts'

export const LINKEDIN_STATE_COOKIE = 'linkedin_oauth_state'

export type LinkedInShareResult = {
  success: boolean
  status: 'posted' | 'skipped' | 'failed'
  message: string
  postUrl?: string
}

export function isLinkedInConfigured() {
  return Boolean(process.env.LINKEDIN_CLIENT_ID && process.env.LINKEDIN_CLIENT_SECRET)
}

export function getLinkedInRedirectUri() {
  return `${getAppUrl()}/api/linkedin/callback`
}

export function getLinkedInScopes() {
  return process.env.LINKEDIN_SCOPES || 'openid profile w_member_social'
}

export function buildLinkedInAuthorizeUrl(state: string) {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: process.env.LINKEDIN_CLIENT_ID ?? '',
    redirect_uri: getLinkedInRedirectUri(),
    state,
    scope: getLinkedInScopes(),
  })
  return `${AUTHORIZE_URL}?${params.toString()}`
}

export function normalizeOrganizationUrn(value: string | null | undefined) {
  const trimmed = value?.trim()
  if (!trimmed) return null
  if (/^urn:li:organization:\d+$/.test(trimmed)) return trimmed
  if (/^\d+$/.test(trimmed)) return `urn:li:organization:${trimmed}`
  return undefined
}

/** Exchanges an OAuth code for a token, looks up the member, and stores the connection. */
export async function completeLinkedInConnection(userId: string, code: string) {
  const tokenResponse = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: getLinkedInRedirectUri(),
      client_id: process.env.LINKEDIN_CLIENT_ID ?? '',
      client_secret: process.env.LINKEDIN_CLIENT_SECRET ?? '',
    }),
    signal: AbortSignal.timeout(15000),
  })
  if (!tokenResponse.ok) {
    const detail = await tokenResponse.text().catch(() => '')
    throw new Error(`LinkedIn token exchange failed (${tokenResponse.status}): ${detail.slice(0, 200)}`)
  }
  const token = (await tokenResponse.json()) as { access_token: string; expires_in: number }

  const profileResponse = await fetch(USERINFO_URL, {
    headers: { Authorization: `Bearer ${token.access_token}` },
    signal: AbortSignal.timeout(15000),
  })
  if (!profileResponse.ok) {
    throw new Error(`Could not read the LinkedIn profile (${profileResponse.status}). Make sure the app has the "openid profile" scopes.`)
  }
  const profile = (await profileResponse.json()) as { sub: string; name?: string }

  const data = {
    accessToken: encryptSecret(token.access_token),
    expiresAt: new Date(Date.now() + token.expires_in * 1000),
    memberUrn: `urn:li:person:${profile.sub}`,
    memberName: profile.name ?? null,
  }

  return prisma.linkedInConnection.upsert({
    where: { userId },
    update: data,
    create: { ...data, userId },
  })
}

/** Posts a job to the recruiter's connected LinkedIn account (member or company page). */
export async function shareJobOnLinkedIn(input: {
  userId: string
  title: string
  companyName: string
  location: string | null
  listingPreview: string
  tags: string[]
  publicUrl: string
}): Promise<LinkedInShareResult> {
  if (!isLinkedInConfigured()) {
    return {
      success: false,
      status: 'skipped',
      message: 'Automatic LinkedIn posting is off. Use "Share on LinkedIn" on the job card to post it.',
    }
  }

  const connection = await prisma.linkedInConnection.findUnique({ where: { userId: input.userId } })
  if (!connection) {
    return { success: false, status: 'skipped', message: 'No LinkedIn account connected for auto-posting. Use "Share on LinkedIn" on the job card to post it.' }
  }

  const accessToken = decryptSecret(connection.accessToken)
  if (!accessToken || connection.expiresAt <= new Date()) {
    return { success: false, status: 'failed', message: 'Your LinkedIn connection has expired. Reconnect LinkedIn from the dashboard and retry.' }
  }

  const author = connection.postAsOrganization && connection.organizationUrn
    ? connection.organizationUrn
    : connection.memberUrn

  const response = await fetch(UGC_POSTS_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'X-Restli-Protocol-Version': '2.0.0',
    },
    body: JSON.stringify({
      author,
      lifecycleState: 'PUBLISHED',
      specificContent: {
        'com.linkedin.ugc.ShareContent': {
          shareCommentary: {
            text: createJobAnnouncementText({
              title: input.title,
              companyName: input.companyName,
              location: input.location,
              tags: input.tags,
              url: input.publicUrl,
            }),
          },
          shareMediaCategory: 'ARTICLE',
          media: [
            {
              status: 'READY',
              originalUrl: input.publicUrl,
              title: { text: `${input.title} at ${input.companyName}`.slice(0, 200) },
              description: { text: input.listingPreview.slice(0, 250) },
            },
          ],
        },
      },
      visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' },
    }),
    signal: AbortSignal.timeout(20000),
  }).catch((error: Error) => error)

  if (response instanceof Error) {
    return { success: false, status: 'failed', message: `LinkedIn post failed: ${response.message}` }
  }

  const text = await response.text()
  if (!response.ok) {
    const hint = response.status === 401
      ? ' Your LinkedIn token was rejected — reconnect LinkedIn.'
      : response.status === 403
        ? ' The connected account lacks permission to post as this author (company pages need the Community Management API and page admin rights).'
        : ''
    return { success: false, status: 'failed', message: `LinkedIn post failed (${response.status}).${hint} ${text.slice(0, 200)}`.trim() }
  }

  const postUrn = response.headers.get('x-restli-id') || safeParseId(text)
  return {
    success: true,
    status: 'posted',
    message: `Posted to LinkedIn as ${author === connection.memberUrn ? connection.memberName || 'your profile' : 'your company page'}.`,
    postUrl: postUrn ? `https://www.linkedin.com/feed/update/${postUrn}/` : undefined,
  }
}

function safeParseId(text: string) {
  try {
    const parsed = JSON.parse(text) as { id?: string }
    return parsed.id
  } catch {
    return undefined
  }
}
