import { NextResponse } from 'next/server'
import { auth } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/prisma'
import { shareJobOnLinkedIn } from '@/lib/linkedin'
import { buildPublicJobUrl } from '@/lib/app-url'
import { logAgentEvent } from '@/lib/agent-events'

// Re-shares a published job on LinkedIn, e.g. after the recruiter connects or reconnects an account.
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })

  const { jobId } = await params
  const job = await prisma.job.findFirst({
    where: { id: jobId, ownerId: session.user.id, status: 'published' },
    include: { owner: { select: { company: true } } },
  })
  if (!job) return NextResponse.json({ message: 'Job not found' }, { status: 404 })
  const company = job.owner.company
  if (!company) return NextResponse.json({ message: 'Add your company profile first.' }, { status: 400 })

  const publicUrl = buildPublicJobUrl(job.slug)
  const linkedinPost = await shareJobOnLinkedIn({
    userId: session.user.id,
    title: job.title,
    companyName: company.name,
    location: company.location,
    listingPreview: company.about,
    tags: parseTags(job.tags),
    publicUrl,
  })

  await prisma.job.update({
    where: { id: job.id },
    data: { linkedinStatus: linkedinPost.status, linkedinPostUrl: linkedinPost.postUrl ?? null, linkedinMessage: linkedinPost.message },
  })
  await logAgentEvent({
    ownerId: session.user.id,
    jobId: job.id,
    type: `linkedin.${linkedinPost.status}`,
    level: linkedinPost.status === 'posted' ? 'success' : linkedinPost.status === 'failed' ? 'error' : 'warning',
    message: `"${job.title}": ${linkedinPost.message}`,
  })

  const httpStatus = linkedinPost.status === 'posted' ? 200 : linkedinPost.status === 'skipped' ? 409 : 502
  return NextResponse.json(linkedinPost, { status: httpStatus })
}

function parseTags(value: string | null): string[] {
  try {
    const parsed = value ? JSON.parse(value) : []
    return Array.isArray(parsed) ? parsed.map(String) : []
  } catch {
    return []
  }
}
