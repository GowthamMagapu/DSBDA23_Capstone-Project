import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const job = await prisma.job.findFirst({
    where: { OR: [{ slug }, { id: slug }], status: 'published' },
    select: {
      title: true,
      description: true,
      requirements: true,
      listing: true,
      tags: true,
      createdAt: true,
      owner: {
        select: {
          company: { select: { name: true, website: true, industry: true, location: true, size: true, about: true, culture: true } },
        },
      },
    },
  })
  if (!job) return NextResponse.json({ message: 'Job not found' }, { status: 404 })
  const { owner, ...publicJob } = job
  return NextResponse.json({ ...publicJob, company: owner.company })
}
