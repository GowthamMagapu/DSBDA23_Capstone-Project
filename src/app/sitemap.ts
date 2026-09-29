import type { MetadataRoute } from 'next'
import { prisma } from '@/lib/prisma'
import { buildPublicJobUrl, getAppUrl } from '@/lib/app-url'

// Rendered per request so it always lists the currently published roles, and so the build
// never needs a database connection.
export const dynamic = 'force-dynamic'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const jobs = await prisma.job.findMany({
    where: { status: 'published' },
    select: { slug: true, updatedAt: true },
    orderBy: { createdAt: 'desc' },
  })

  return [
    { url: getAppUrl(), changeFrequency: 'weekly', priority: 0.5 },
    ...jobs.map((job) => ({
      url: buildPublicJobUrl(job.slug),
      lastModified: job.updatedAt,
      changeFrequency: 'daily' as const,
      priority: 1,
    })),
  ]
}
