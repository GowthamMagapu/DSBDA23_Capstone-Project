/** Absolute base URL of the deployed app, without a trailing slash. */
export function getAppUrl() {
  const url = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || 'http://localhost:3000'
  return url.replace(/\/$/, '')
}

export function buildPublicJobUrl(slug: string) {
  return `${getAppUrl()}/careers/${slug}`
}
