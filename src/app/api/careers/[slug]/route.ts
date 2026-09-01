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
    },
  })
  if (!job) return NextResponse.json({ message: 'Job not found' }, { status: 404 })
  return NextResponse.json(job)
}
