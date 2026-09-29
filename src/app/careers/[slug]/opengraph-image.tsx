import { parseJobTags } from '@/lib/job-sharing'
import { JOB_CARD_SIZE, renderJobCardImage } from '@/lib/job-card-image'
import { getPublishedJob } from '@/lib/public-job'

// Served by Next.js as the careers page's og:image, so every published role gets its own card.

export const alt = 'Job opening on AgentU'
export const size = JOB_CARD_SIZE
export const contentType = 'image/png'

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const job = await getPublishedJob(slug)
  const company = job?.owner.company

  return renderJobCardImage({
    title: job?.title ?? 'Open roles',
    companyName: company?.name ?? 'AgentU',
    location: company?.location?.trim() || null,
    tags: parseJobTags(job?.tags),
    found: Boolean(job),
  })
}
