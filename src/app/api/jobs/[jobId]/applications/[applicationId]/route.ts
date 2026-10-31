import { NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/prisma'
import { logAgentEvent } from '@/lib/agent-events'
import { PIPELINE_STAGES, STAGE_LABELS, formatInterviewTime, pipelineStageOf } from '@/lib/management'

// Management agent: the recruiter moves a candidate through the pipeline, schedules their
// interview and records feedback. Every change is mirrored into the activity feed.

const updateSchema = z.object({
  stage: z.enum(PIPELINE_STAGES).optional(),
  interviewAt: z.string().datetime({ offset: true }).nullable().optional(),
  interviewLink: z.string().trim().max(500).nullable().optional(),
  feedbackRating: z.number().int().min(1).max(5).nullable().optional(),
  feedbackNotes: z.string().trim().max(4000).nullable().optional(),
  timeZone: z.string().max(64).optional(),
})

const MANAGED_APPLICATION_FIELDS = {
  id: true,
  stage: true,
  stageUpdatedAt: true,
  interviewAt: true,
  interviewLink: true,
  feedbackRating: true,
  feedbackNotes: true,
} as const

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ jobId: string; applicationId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })

  const parsed = updateSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ message: 'Invalid update.' }, { status: 400 })

  const { jobId, applicationId } = await params
  const application = await prisma.application.findFirst({
    where: { id: applicationId, jobId, job: { ownerId: session.user.id } },
    select: { candidateName: true, stage: true, interviewAt: true, job: { select: { title: true } } },
  })
  if (!application) return NextResponse.json({ message: 'Application not found' }, { status: 404 })

  const { stage, interviewAt, interviewLink, feedbackRating, feedbackNotes, timeZone } = parsed.data
  const stageChanged = stage !== undefined && stage !== pipelineStageOf(application.stage)
  const newInterviewAt = interviewAt === undefined ? undefined : interviewAt === null ? null : new Date(interviewAt)

  const updated = await prisma.application.update({
    where: { id: applicationId },
    data: {
      ...(stageChanged ? { stage, stageUpdatedAt: new Date() } : {}),
      ...(newInterviewAt !== undefined ? { interviewAt: newInterviewAt } : {}),
      ...(interviewLink !== undefined ? { interviewLink: interviewLink || null } : {}),
      ...(feedbackRating !== undefined ? { feedbackRating } : {}),
      ...(feedbackNotes !== undefined ? { feedbackNotes: feedbackNotes || null } : {}),
    },
    select: MANAGED_APPLICATION_FIELDS,
  })

  const ownerId = session.user.id
  const who = `${application.candidateName} for "${application.job.title}"`
  if (stageChanged && stage) {
    await logAgentEvent({
      ownerId,
      jobId,
      type: 'management.stage',
      level: stage === 'hired' ? 'success' : 'info',
      message: `Moved ${who} to ${STAGE_LABELS[stage]}.`,
    })
  }
  if (newInterviewAt && newInterviewAt.getTime() !== application.interviewAt?.getTime()) {
    await logAgentEvent({
      ownerId,
      jobId,
      type: 'management.interview',
      message: `Scheduled an interview with ${who} on ${formatInterviewTime(newInterviewAt, timeZone)}.`,
    })
  }
  if (feedbackRating !== undefined || feedbackNotes !== undefined) {
    await logAgentEvent({
      ownerId,
      jobId,
      type: 'management.feedback',
      message: `Recorded interview feedback for ${who}${updated.feedbackRating ? ` (${updated.feedbackRating}/5)` : ''}.`,
    })
  }

  return NextResponse.json(updated)
}
