import { NextRequest, NextResponse, after } from 'next/server'
import { auth } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/prisma'
import { generateJobListing, createSlug } from '@/lib/job-listing'
import { analyzeApplication } from '@/lib/application-analysis'
import { shareJobOnLinkedIn } from '@/lib/linkedin'
import { buildPublicJobUrl } from '@/lib/app-url'
import { logAgentEvent } from '@/lib/agent-events'
import { notifyCandidatePoolScored, notifyJobPublished } from '@/lib/notifications'
import { distributeJob } from '@/lib/job-distribution'
import { z } from 'zod'

const jobSchema = z.object({
  title: z.string().min(3).max(200),
  description: z.string().min(20).max(10000),
  requirements: z.string().min(3).max(10000),
  autoApplyExistingCandidates: z.boolean().optional().default(false),
})

// Caps how many existing-candidate re-analyses run concurrently when a recruiter
// opts in, so a large candidate pool can't fan out into an unbounded burst of
// simultaneous Gemini calls / DB writes on a single request.
const AUTO_APPLY_CONCURRENCY = 3

async function runWithConcurrency<T>(items: T[], limit: number, task: (item: T) => Promise<void>) {
  let index = 0
  async function worker() {
    while (index < items.length) {
      const item = items[index++]
      await task(item)
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
}

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })

  const jobs = await prisma.job.findMany({
    where: { ownerId: session.user.id },
    include: { _count: { select: { applications: true } } },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json(jobs)
}

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
  const ownerId = session.user.id

  const parsed = jobSchema.safeParse(await request.json())
  if (!parsed.success) return NextResponse.json({ message: 'Please complete all job fields.' }, { status: 400 })

  const company = await prisma.company.findUnique({ where: { ownerId } })
  if (!company) {
    return NextResponse.json({ message: 'Tell the HR agent about your company before publishing a job.' }, { status: 400 })
  }

  await logAgentEvent({ ownerId, type: 'job.drafting', message: `Drafting a public listing for "${parsed.data.title}" at ${company.name}…` })
  const listing = await generateJobListing(parsed.data.title, parsed.data.description, parsed.data.requirements, company)

  const job = await prisma.job.create({
    data: {
      title: parsed.data.title,
      description: parsed.data.description,
      requirements: parsed.data.requirements,
      slug: createSlug(listing.headline || parsed.data.title),
      listing: listing.listing,
      tags: JSON.stringify(listing.tags),
      ownerId,
      status: 'published',
    },
  })

  const publicUrl = buildPublicJobUrl(job.slug)
  await logAgentEvent({
    ownerId,
    jobId: job.id,
    type: 'job.published',
    level: 'success',
    message: `Published "${job.title}"${listing.aiGenerated ? ' with an AI-written listing' : ''}. Public link: ${publicUrl}`,
  })

  const linkedinPost = await shareJobOnLinkedIn({
    userId: ownerId,
    title: job.title,
    companyName: company.name,
    location: company.location,
    listingPreview: company.about,
    tags: listing.tags,
    publicUrl,
  })
  const publishedJob = await prisma.job.update({
    where: { id: job.id },
    data: { linkedinStatus: linkedinPost.status, linkedinPostUrl: linkedinPost.postUrl ?? null, linkedinMessage: linkedinPost.message },
  })
  await logAgentEvent({
    ownerId,
    jobId: job.id,
    type: `linkedin.${linkedinPost.status}`,
    level: linkedinPost.status === 'posted' ? 'success' : linkedinPost.status === 'failed' ? 'error' : 'warning',
    message: linkedinPost.message,
  })

  // Distribution, email and candidate-pool scoring run after the response so publishing stays
  // fast; progress shows up in the live activity feed and the recruiter's inbox.
  after(async () => {
    try {
      await distributeJob({
        ownerId,
        jobId: job.id,
        title: job.title,
        companyName: company.name,
        location: company.location,
        tags: listing.tags,
        publicUrl,
      })
      await notifyJobPublished({ ownerId, jobId: job.id, title: job.title, publicUrl, linkedin: linkedinPost })

      if (!parsed.data.autoApplyExistingCandidates) return
      const profiles = await prisma.candidateProfile.findMany({ where: { ownerId } })
      if (profiles.length === 0) return

      await logAgentEvent({ ownerId, jobId: job.id, type: 'pool.scoring', message: `Scoring ${profiles.length} existing candidate${profiles.length === 1 ? '' : 's'} against "${job.title}"…` })
      const scored: { name: string; score: number; status: string }[] = []
      await runWithConcurrency(profiles, AUTO_APPLY_CONCURRENCY, async (profile) => {
        const analysis = await analyzeApplication(profile.resumeText, job.title, job.requirements)
        await prisma.application.create({
          data: {
            candidateName: profile.name,
            email: profile.email,
            resumeText: profile.resumeText,
            coverLetter: profile.coverLetter,
            resumeFileName: profile.resumeFileName,
            resumeMimeType: profile.resumeMimeType,
            resumeData: profile.resumeData,
            jobId: job.id,
            profileId: profile.id,
            score: analysis.score,
            status: analysis.status,
            aiSummary: analysis.aiSummary,
            matchedSkills: JSON.stringify(analysis.matchedSkills),
            missingSkills: JSON.stringify(analysis.missingSkills),
            source: 'existing-profile',
          },
        })
        scored.push({ name: profile.name, score: analysis.score, status: analysis.status })
      })
      await logAgentEvent({ ownerId, jobId: job.id, type: 'pool.scored', level: 'success', message: `Scored ${scored.length} existing candidate${scored.length === 1 ? '' : 's'} for "${job.title}".` })
      await notifyCandidatePoolScored({ ownerId, jobId: job.id, jobTitle: job.title, scored })
    } catch (error) {
      await logAgentEvent({
        ownerId,
        jobId: job.id,
        type: 'agent.error',
        level: 'error',
        message: `Background work for "${job.title}" stopped: ${error instanceof Error ? error.message : 'unknown error'}`,
      })
    }
  })

  return NextResponse.json({
    ...publishedJob,
    publicUrl,
    linkedinPost,
  }, { status: 201 })
}
