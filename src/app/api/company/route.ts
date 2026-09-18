import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/prisma'
import { companySchema } from '@/lib/company'
import { logAgentEvent } from '@/lib/agent-events'

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })

  const company = await prisma.company.findUnique({ where: { ownerId: session.user.id } })
  return NextResponse.json({ company, accountEmail: session.user.email ?? null })
}

export async function PUT(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })

  const parsed = companySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ message: parsed.error.issues[0]?.message || 'Please check the company details.' }, { status: 400 })
  }

  const existing = await prisma.company.findUnique({ where: { ownerId: session.user.id }, select: { id: true } })
  const company = await prisma.company.upsert({
    where: { ownerId: session.user.id },
    update: parsed.data,
    create: { ...parsed.data, ownerId: session.user.id },
  })

  await logAgentEvent({
    ownerId: session.user.id,
    type: 'company.saved',
    level: 'success',
    message: existing
      ? `Updated the ${company.name} company profile. New listings will use it.`
      : `Learned about ${company.name}. The HR agent is ready to publish roles.`,
  })

  return NextResponse.json({ company })
}
