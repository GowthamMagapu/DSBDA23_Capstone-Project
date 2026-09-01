import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/app/api/auth/[...nextauth]/route'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params
  const job = await prisma.job.findFirst({ where: { id: jobId, status: 'published' } })
  if (!job) return NextResponse.json({ message: 'Job not found' }, { status: 404 })
  return NextResponse.json(job)
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })

  const { jobId } = await params
  const job = await prisma.job.findFirst({ where: { id: jobId, ownerId: session.user.id } })
  if (!job) return NextResponse.json({ message: 'Job not found' }, { status: 404 })

  await prisma.job.delete({ where: { id: jobId } })
  return NextResponse.json({ success: true })
}
