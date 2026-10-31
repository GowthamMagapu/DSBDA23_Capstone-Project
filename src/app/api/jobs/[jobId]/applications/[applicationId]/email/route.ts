import { NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/prisma'
import { logAgentEvent } from '@/lib/agent-events'
import { sendEmail } from '@/lib/email'
import { candidateEmailHtml, draftCandidateEmail } from '@/lib/candidate-email'
import { CANDIDATE_EMAIL_KINDS, EMAIL_KIND_LABELS } from '@/lib/management'

// Management agent: drafts an email to a candidate (AI, with a template fallback), and sends
// the version the recruiter approved. Drafting and sending are separate calls on purpose: no
// email reaches a candidate without the recruiter reading it first.

const requestSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('draft'),
    kind: z.enum(CANDIDATE_EMAIL_KINDS),
    note: z.string().max(1000).optional(),
    timeZone: z.string().max(64).optional(),
  }),
  z.object({
    action: z.literal('send'),
    kind: z.enum(CANDIDATE_EMAIL_KINDS),
    subject: z.string().trim().min(1).max(200),
    body: z.string().trim().min(1).max(5000),
  }),
])

export async function POST(
  request: Request,
  { params }: { params: Promise<{ jobId: string; applicationId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })

  const parsed = requestSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ message: 'Invalid email request.' }, { status: 400 })

  const ownerId = session.user.id
  const { jobId, applicationId } = await params
  const application = await prisma.application.findFirst({
    where: { id: applicationId, jobId, job: { ownerId } },
    select: {
      candidateName: true,
      email: true,
      interviewAt: true,
      interviewLink: true,
      job: { select: { title: true, owner: { select: { email: true, company: { select: { name: true, notificationEmail: true } } } } } },
    },
  })
  if (!application) return NextResponse.json({ message: 'Application not found' }, { status: 404 })

  const companyName = application.job.owner.company?.name ?? 'Our company'

  if (parsed.data.action === 'draft') {
    const draft = await draftCandidateEmail({
      kind: parsed.data.kind,
      candidateName: application.candidateName,
      jobTitle: application.job.title,
      companyName,
      interviewAt: application.interviewAt?.toISOString() ?? null,
      interviewLink: application.interviewLink,
      timeZone: parsed.data.timeZone,
      note: parsed.data.note,
    })
    return NextResponse.json(draft)
  }

  const { kind, subject, body } = parsed.data
  const replyTo = application.job.owner.company?.notificationEmail || application.job.owner.email
  const result = await sendEmail({
    to: application.email,
    subject,
    text: body,
    html: candidateEmailHtml(body, companyName),
    replyTo,
  })
  const label = EMAIL_KIND_LABELS[kind].toLowerCase()
  await logAgentEvent({
    ownerId,
    jobId,
    type: result.sent ? 'management.email' : 'management.email_skipped',
    level: result.sent ? 'success' : 'warning',
    message: result.sent
      ? `Emailed ${application.candidateName} a ${label} for "${application.job.title}".`
      : `Could not email ${application.candidateName} a ${label} (${result.reason}).`,
  })
  return NextResponse.json(result, { status: result.sent ? 200 : 502 })
}
