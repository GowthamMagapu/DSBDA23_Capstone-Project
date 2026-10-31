// Pure helpers for distributing a published job without any third-party API approval.
// Kept free of server imports so the dashboard (a client component) can use them too.

const LINKEDIN_SHARE_URL = 'https://www.linkedin.com/sharing/share-offsite/'
const LISTING_VALID_DAYS = 60

/**
 * Google for Jobs rejects a JobPosting without a country, but recruiters often type only a
 * city ("Hyderabad"). This is the country assumed when the company location names none;
 * the careers page lets JOB_DEFAULT_COUNTRY override it.
 */
export const DEFAULT_JOB_COUNTRY = 'IN'

export function createJobAnnouncementText(input: {
  title: string
  companyName: string
  location: string | null
  tags: string[]
  url: string
}) {
  const hashtags = ['Hiring', ...input.tags]
    .map((tag) => `#${tag.replace(/[^a-z0-9]/gi, '')}`)
    .filter((tag) => tag.length > 1)
    .slice(0, 6)
    .join(' ')

  return [
    `${input.companyName} is hiring! 🚀`,
    '',
    `We're looking for a ${input.title}${input.location ? ` (${input.location})` : ''} to join our team.`,
    '',
    'If you or someone you know would be a great fit, apply here:',
    input.url,
    '',
    hashtags,
  ].join('\n')
}

/**
 * LinkedIn's public share dialog. Needs no developer app or OAuth: the recruiter is sent to
 * LinkedIn's own composer with the job link attached, and the preview card is built from the
 * careers page's Open Graph tags. LinkedIn ignores any text parameter, so the post text is
 * copied to the clipboard separately.
 */
export function buildLinkedInShareUrl(jobUrl: string) {
  return `${LINKEDIN_SHARE_URL}?${new URLSearchParams({ url: jobUrl }).toString()}`
}

export function parseJobTags(value: string | null | undefined): string[] {
  try {
    const parsed = value ? JSON.parse(value) : []
    return Array.isArray(parsed) ? parsed.map(String) : []
  } catch {
    return []
  }
}

/**
 * schema.org JobPosting for Google for Jobs (https://developers.google.com/search/docs/appearance/structured-data/job-posting).
 * Google indexes this from the public careers page — no account or approval required.
 */
export function buildJobPostingJsonLd(input: {
  title: string
  listing: string
  url: string
  datePosted: Date
  company: { name: string; website: string | null; location: string | null }
  /** Country used when the location names none; defaults to DEFAULT_JOB_COUNTRY. */
  defaultCountry?: string
}) {
  const validThrough = new Date(input.datePosted.getTime() + LISTING_VALID_DAYS * 24 * 60 * 60 * 1000)
  const location = input.company.location?.trim() || null
  const isRemote = Boolean(location && /\bremote\b/i.test(location))
  const website = normalizeWebsite(input.company.website)
  const defaultCountry = input.defaultCountry?.trim() || DEFAULT_JOB_COUNTRY

  // Google requires a country on every posting: on the address of an on-site role, or as the
  // applicant location requirement of a fully remote one.
  const place: {
    jobLocationType?: 'TELECOMMUTE'
    applicantLocationRequirements?: { '@type': 'Country'; name: string }
    jobLocation?: { '@type': 'Place'; address: Record<string, string> }
  } = isRemote
    ? {
        jobLocationType: 'TELECOMMUTE',
        applicantLocationRequirements: { '@type': 'Country', name: remoteCountry(location!, defaultCountry) },
      }
    : { jobLocation: { '@type': 'Place', address: toPostalAddress(location, defaultCountry) } }

  return {
    '@context': 'https://schema.org/',
    '@type': 'JobPosting',
    title: input.title,
    description: toHtmlParagraphs(input.listing),
    datePosted: input.datePosted.toISOString(),
    validThrough: validThrough.toISOString(),
    url: input.url,
    directApply: true,
    hiringOrganization: {
      '@type': 'Organization',
      name: input.company.name,
      ...(website ? { sameAs: website } : {}),
    },
    ...place,
  }
}

/** Serialises JSON-LD so it can't break out of its <script> tag. */
export function serializeJsonLd(data: unknown) {
  return JSON.stringify(data).replace(/</g, '\\u003c')
}

// "Hyderabad, Telangana, India" → locality "Hyderabad", region "Telangana", country "India".
// "Hyderabad" → locality "Hyderabad" in the default country; no location → the country alone.
function toPostalAddress(location: string | null, defaultCountry: string) {
  const parts = (location ?? '').split(',').map((part) => part.trim()).filter(Boolean)
  const address: Record<string, string> = { '@type': 'PostalAddress' }
  if (parts.length >= 1) address.addressLocality = parts[0]
  if (parts.length >= 3) address.addressRegion = parts[1]
  address.addressCountry = parts.length >= 2 ? parts[parts.length - 1] : defaultCountry
  return address
}

// "Remote (India)" or "Remote - Hyderabad, India" → "India"; plain "Remote" → the default.
function remoteCountry(location: string, defaultCountry: string) {
  const rest = location
    .replace(/\bremote\b/gi, ' ')
    .replace(/[()\-–—/|]/g, ' ')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
  return rest[rest.length - 1] ?? defaultCountry
}

function toHtmlParagraphs(text: string) {
  return text
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, '<br>')}</p>`)
    .join('')
}

function escapeHtml(value: string) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function normalizeWebsite(value: string | null) {
  const trimmed = value?.trim()
  if (!trimmed) return null
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
}
