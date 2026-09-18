import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/prisma'

// Polled by the dashboard's live activity feed. Pass `since` (ISO timestamp of the newest event
// the client has) to receive only newer events.
export async function GET(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })

  const sinceParam = request.nextUrl.searchParams.get('since')
  const since = sinceParam ? new Date(sinceParam) : null

  const events = await prisma.agentEvent.findMany({
    where: {
      ownerId: session.user.id,
      ...(since && !Number.isNaN(since.getTime()) ? { createdAt: { gt: since } } : {}),
    },
    select: { id: true, type: true, level: true, message: true, jobId: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
    take: 40,
  })

  return NextResponse.json(events)
}
