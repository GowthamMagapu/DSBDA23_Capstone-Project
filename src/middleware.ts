import { auth } from '@/app/api/auth/[...nextauth]/route'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

export default auth((req) => {
  const isLoggedIn = !!req.auth
  const isOnAuthPage = req.nextUrl.pathname.startsWith('/auth')
  const isOnDashboard = req.nextUrl.pathname.startsWith('/dashboard')

  if (isOnAuthPage) {
    if (isLoggedIn) {
      return NextResponse.redirect(new URL('/dashboard', req.nextUrl))
    }
    return NextResponse.next()
  }

  if (isOnDashboard) {
    if (!isLoggedIn) {
      return NextResponse.redirect(new URL('/auth/signin', req.nextUrl))
    }
    return NextResponse.next()
  }

  if (req.nextUrl.pathname === '/') {
    if (isLoggedIn) {
      return NextResponse.redirect(new URL('/dashboard', req.nextUrl))
    }
    return NextResponse.next()
  }

  return NextResponse.next()
})

export const config = {
  matcher: [
    '/',
    '/auth/:path*',
    '/dashboard/:path*',
  ],
}