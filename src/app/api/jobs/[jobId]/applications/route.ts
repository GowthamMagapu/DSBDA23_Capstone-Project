import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/prisma'
import { analyzeApplication } from '@/lib/application-analysis'
import { extractResumeText } from '@/lib/resume-text'
import { z } from 'zod'

const applicationSchema = z.object({
  candidateName: z.string().min(2),
  email: z.string().email(),
  coverLetter: z.string().min(30),
})

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })

  const { jobId } = await params
  const job = await prisma.job.findFirst({ where: { id: jobId, ownerId: session.user.id } })
  if (!job) return NextResponse.json({ message: 'Job not found' }, { status: 404 })

  const applications = await prisma.application.findMany({
    where: { jobId },
    select: {
      id: true,
      candidateName: true,
      email: true,
      score: true,
      status: true,
      aiSummary: true,
      matchedSkills: true,
      missingSkills: true,
      resumeFileName: true,
      createdAt: true,
    },
    orderBy: { score: 'desc' },
  })
  return NextResponse.json(applications)
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params
  const formData = await request.formData()
  const resume = formData.get('resume')
  if (!(resume instanceof File) || resume.size === 0) return NextResponse.json({ message: 'Please attach your resume.' }, { status: 400 })
  if (resume.size > 10 * 1024 * 1024) return NextResponse.json({ message: 'Resume must be smaller than 10 MB.' }, { status: 400 })

  const parsed = applicationSchema.safeParse({
    candidateName: formData.get('candidateName'),
    email: formData.get('email'),
    coverLetter: formData.get('coverLetter'),
  })
  if (!parsed.success) return NextResponse.json({ message: 'Please provide your name and a cover letter.' }, { status: 400 })

  const job = await prisma.job.findFirst({
    where: { OR: [{ id: jobId }, { slug: jobId }], status: 'published' },
  })
  if (!job) return NextResponse.json({ message: 'Job not found' }, { status: 404 })

  const resumeData = Buffer.from(await resume.arrayBuffer())
  const extractedText = await extractResumeText(resume, resumeData)
  const resumeText = `${extractedText}\n${parsed.data.coverLetter}`.slice(0, 20000)
  const analysis = await analyzeApplication(resumeText, job.title, job.requirements)
  const profile = await prisma.candidateProfile.upsert({
    where: { email: parsed.data.email },
    update: {
      name: parsed.data.candidateName,
      resumeText,
      coverLetter: parsed.data.coverLetter,
      resumeFileName: resume.name,
      resumeMimeType: resume.type || 'application/octet-stream',
      resumeData,
      ownerId: job.ownerId,
    },
    create: {
      name: parsed.data.candidateName,
      email: parsed.data.email,
      resumeText,
      coverLetter: parsed.data.coverLetter,
      resumeFileName: resume.name,
      resumeMimeType: resume.type || 'application/octet-stream',
      resumeData,
      ownerId: job.ownerId,
    },
  })
  const application = await prisma.application.create({
    data: {
      candidateName: parsed.data.candidateName,
      email: parsed.data.email,
      resumeText,
      coverLetter: parsed.data.coverLetter,
      resumeFileName: resume.name,
      resumeMimeType: resume.type || 'application/octet-stream',
      resumeData,
      jobId: job.id,
      profileId: profile.id,
      score: analysis.score,
      status: analysis.status,
      aiSummary: analysis.aiSummary,
      matchedSkills: JSON.stringify(analysis.matchedSkills),
      missingSkills: JSON.stringify(analysis.missingSkills),
      source: 'public',
    },
  })
  return NextResponse.json({ id: application.id, message: 'Application received' }, { status: 201 })
}
