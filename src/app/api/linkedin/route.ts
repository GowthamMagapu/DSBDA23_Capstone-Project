import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/prisma'
import { getLinkedInRedirectUri, isLinkedInConfigured, normalizeOrganizationUrn } from '@/lib/linkedin'
import { logAgentEvent } from '@/lib/agent-events'

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })

  const connection = await prisma.linkedInConnection.findUnique({
    where: { userId: session.user.id },
    select: { memberName: true, expiresAt: true, organizationUrn: true, postAsOrganization: true },
  })

  return NextResponse.json({
    configured: isLinkedInConfigured(),
    redirectUri: getLinkedInRedirectUri(),
    connection: connection && { ...connection, expired: connection.expiresAt <= new Date() },
  })
}

const settingsSchema = z.object({
  organizationUrn: z.string().max(80).optional().nullable(),
  postAsOrganization: z.boolean(),
})

export async function PATCH(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })

  const parsed = settingsSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ message: 'Invalid LinkedIn settings.' }, { status: 400 })

  const organizationUrn = normalizeOrganizationUrn(parsed.data.organizationUrn)
  if (organizationUrn === undefined) {
    return NextResponse.json({ message: 'Company page ID must be a number or urn:li:organization:<number>.' }, { status: 400 })
  }
  if (parsed.data.postAsOrganization && !organizationUrn) {
    return NextResponse.json({ message: 'Add your LinkedIn company page ID to post as the company.' }, { status: 400 })
  }

  const existing = await prisma.linkedInConnection.findUnique({ where: { userId: session.user.id }, select: { id: true } })
  if (!existing) return NextResponse.json({ message: 'Connect LinkedIn first.' }, { status: 400 })

  await prisma.linkedInConnection.update({
    where: { userId: session.user.id },
    data: { organizationUrn, postAsOrganization: parsed.data.postAsOrganization },
  })
  return NextResponse.json({ success: true, organizationUrn })
}

export async function DELETE() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })

  await prisma.linkedInConnection.deleteMany({ where: { userId: session.user.id } })
  await logAgentEvent({ ownerId: session.user.id, type: 'linkedin.disconnected', message: 'Disconnected LinkedIn. New jobs will not be auto-posted.' })
  return NextResponse.json({ success: true })
}
