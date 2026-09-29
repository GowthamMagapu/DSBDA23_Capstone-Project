import { cache } from 'react'
import type { Metadata } from 'next'
import { prisma } from '@/lib/prisma'
import { buildPublicJobUrl } from '@/lib/app-url'
import { buildJobPostingJsonLd, serializeJsonLd } from '@/lib/job-sharing'
import CareersClient from './CareersClient'

type Props = { params: Promise<{ slug: string }> }

// Shared by generateMetadata and the page so the job is only queried once per request.
const getPublishedJob = cache((slug: string) =>
  prisma.job.findFirst({
    where: { OR: [{ slug }, { id: slug }], status: 'published' },
    select: {
      title: true,
      slug: true,
      description: true,
      listing: true,
      createdAt: true,
      owner: { select: { company: { select: { name: true, about: true, location: true, website: true } } } },
    },
  })
)

// Server-rendered metadata so LinkedIn (and other link unfurlers) show a rich preview of the role.
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const job = await getPublishedJob(slug)
  if (!job) return { title: 'Job not found' }

  const company = job.owner.company
  const title = company ? `${job.title} at ${company.name}` : job.title
  const description = [company?.location, company?.about || job.description].filter(Boolean).join(' · ').slice(0, 200)
  const url = buildPublicJobUrl(job.slug)

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { type: 'website', url, title, description, siteName: company?.name ?? 'AgentU' },
    twitter: { card: 'summary', title, description },
  }
}

export default async function CareersPage({ params }: Props) {
  const { slug } = await params
  const job = await getPublishedJob(slug)
  const company = job?.owner.company

  // JobPosting structured data lets Google for Jobs index the role without any API approval.
  const jsonLd = job && company
    ? buildJobPostingJsonLd({
        title: job.title,
        listing: job.listing || job.description,
        url: buildPublicJobUrl(job.slug),
        datePosted: job.createdAt,
        company,
      })
    : null

  return (
    <>
      {jsonLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }} />}
      <CareersClient slug={slug} />
    </>
  )
}
