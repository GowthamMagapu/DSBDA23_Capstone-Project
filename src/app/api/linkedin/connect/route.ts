import crypto from 'crypto'
import { NextResponse } from 'next/server'
import { auth } from '@/app/api/auth/[...nextauth]/route'
import { getAppUrl } from '@/lib/app-url'
import { LINKEDIN_STATE_COOKIE, buildLinkedInAuthorizeUrl, isLinkedInConfigured } from '@/lib/linkedin'

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.redirect(`${getAppUrl()}/auth/signin`)

  if (!isLinkedInConfigured()) {
    return NextResponse.redirect(`${getAppUrl()}/dashboard?linkedin=not-configured`)
  }

  const state = crypto.randomBytes(24).toString('hex')
  const response = NextResponse.redirect(buildLinkedInAuthorizeUrl(state))
  response.cookies.set(LINKEDIN_STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/api/linkedin',
    maxAge: 10 * 60,
  })
  return response
}
