import { NextResponse } from 'next/server'
import { auth } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/prisma'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ jobId: string; applicationId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })

  const { jobId, applicationId } = await params
  const application = await prisma.application.findFirst({
    where: { id: applicationId, jobId, job: { ownerId: session.user.id } },
    select: { resumeData: true, resumeFileName: true, resumeMimeType: true },
  })
  if (!application?.resumeData) return NextResponse.json({ message: 'Resume not found' }, { status: 404 })

  return new NextResponse(application.resumeData, {
    headers: {
      'Content-Type': application.resumeMimeType || 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${application.resumeFileName || 'resume'}"`,
    },
  })
}