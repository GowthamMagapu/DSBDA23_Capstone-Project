import crypto from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/app/api/auth/[...nextauth]/route'
import { getAppUrl } from '@/lib/app-url'
import { LINKEDIN_STATE_COOKIE, completeLinkedInConnection } from '@/lib/linkedin'
import { logAgentEvent } from '@/lib/agent-events'

function redirectToDashboard(result: string) {
  const response = NextResponse.redirect(`${getAppUrl()}/dashboard?linkedin=${result}`)
  response.cookies.delete({ name: LINKEDIN_STATE_COOKIE, path: '/api/linkedin' })
  return response
}

function statesMatch(expected: string | undefined, received: string | null) {
  if (!expected || !received || expected.length !== received.length) return false
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(received))
}

export async function GET(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.redirect(`${getAppUrl()}/auth/signin`)

  const params = request.nextUrl.searchParams
  if (!statesMatch(request.cookies.get(LINKEDIN_STATE_COOKIE)?.value, params.get('state'))) {
    return redirectToDashboard('invalid-state')
  }

  // The recruiter declined consent on LinkedIn.
  if (params.get('error')) return redirectToDashboard('denied')

  const code = params.get('code')
  if (!code) return redirectToDashboard('error')

  try {
    const connection = await completeLinkedInConnection(session.user.id, code)
    await logAgentEvent({
      ownerId: session.user.id,
      type: 'linkedin.connected',
      level: 'success',
      message: `Connected LinkedIn${connection.memberName ? ` as ${connection.memberName}` : ''}. New jobs will be posted automatically.`,
    })
    return redirectToDashboard('connected')
  } catch (error) {
    await logAgentEvent({
      ownerId: session.user.id,
      type: 'linkedin.error',
      level: 'error',
      message: error instanceof Error ? error.message : 'LinkedIn connection failed.',
    })
    return redirectToDashboard('error')
  }
}
