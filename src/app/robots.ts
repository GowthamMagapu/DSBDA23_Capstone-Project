import type { MetadataRoute } from 'next'
import { getAppUrl } from '@/lib/app-url'

export default function robots(): MetadataRoute.Robots {
  return {
    // /api stays crawlable: careers pages load the listing from /api/jobs, and Google checks that
    // the visible content matches the JobPosting structured data.
    rules: { userAgent: '*', allow: '/', disallow: ['/dashboard', '/auth/'] },
    sitemap: `${getAppUrl()}/sitemap.xml`,
  }
}
