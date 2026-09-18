import type { Metadata } from 'next'
import { prisma } from '@/lib/prisma'
import { buildPublicJobUrl } from '@/lib/app-url'
import CareersClient from './CareersClient'

type Props = { params: Promise<{ slug: string }> }

// Server-rendered metadata so LinkedIn (and other link unfurlers) show a rich preview of the role.
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const job = await prisma.job.findFirst({
    where: { OR: [{ slug }, { id: slug }], status: 'published' },
    select: {
      title: true,
      slug: true,
      description: true,
      owner: { select: { company: { select: { name: true, about: true, location: true } } } },
    },
  })
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
  return <CareersClient slug={slug} />
}
