import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/prisma'
import { generateJobListing, createSlug } from '@/lib/job-listing'
import { analyzeApplication } from '@/lib/application-analysis'
import { buildPublicJobUrl, publishJobToLinkedIn } from '@/lib/linkedin'
import { z } from 'zod'

const jobSchema = z.object({
  title: z.string().min(3),
  description: z.string().min(20),
  requirements: z.string().min(3),
})

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

  const parsed = jobSchema.safeParse(await request.json())
  if (!parsed.success) return NextResponse.json({ message: 'Please complete all job fields.' }, { status: 400 })

  const listing = await generateJobListing(parsed.data.title, parsed.data.description, parsed.data.requirements)

  const job = await prisma.job.create({
    data: {
      title: parsed.data.title,
      description: parsed.data.description,
      requirements: parsed.data.requirements,
      slug: createSlug(listing.headline || parsed.data.title),
      listing: listing.listing,
      tags: JSON.stringify(listing.tags),
      ownerId: session.user.id,
      status: 'published',
    },
  })

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || 'http://localhost:3000'
  const publicUrl = buildPublicJobUrl(baseUrl, job.slug || 'job')
  const linkedinPost = await publishJobToLinkedIn(job.title, publicUrl)

  const profiles = await prisma.candidateProfile.findMany({ where: { ownerId: session.user.id } })
  await Promise.all(profiles.map(async (profile) => {
    const analysis = await analyzeApplication(profile.resumeText, job.title, job.requirements)
    return prisma.application.create({
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
  }))

  return NextResponse.json({
    ...job,
    linkedinPost,
  }, { status: 201 })
}
