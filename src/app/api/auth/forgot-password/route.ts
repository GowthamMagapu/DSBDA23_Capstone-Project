import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { sendPasswordResetEmail } from '@/lib/email'

const forgotPasswordSchema = z.object({
  email: z.string().trim().email('Please enter a valid email address.'),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const parsed = forgotPasswordSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          message: parsed.error.issues[0]?.message || 'Please enter a valid email address.',
        },
        { status: 400 },
      )
    }

    const email = parsed.data.email.toLowerCase()
    const user = await prisma.user.findUnique({
      where: { email },
    })

    if (user) {
      const token = crypto.randomBytes(32).toString('hex')
      const expiresAt = new Date(Date.now() + 1000 * 60 * 60)

      await prisma.user.update({
        where: { id: user.id },
        data: {
          resetToken: token,
          resetTokenExpires: expiresAt,
        },
      })

      const origin = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || 'http://localhost:3000'
      const resetUrl = `${origin}/auth/reset-password/${token}`

      const mailResult = await sendPasswordResetEmail(email, resetUrl)

      if (!mailResult.sent && process.env.NODE_ENV !== 'production') {
        return NextResponse.json({
          success: true,
          message: 'If an account exists for this email, we have sent a password reset link.',
          resetUrl,
        })
      }

      if (!mailResult.sent) {
        return NextResponse.json({
          success: false,
          message: 'Email delivery is not configured yet. Please contact support or configure SMTP settings.',
        }, { status: 500 })
      }

      return NextResponse.json({
        success: true,
        message: 'If an account exists for this email, we have sent a password reset link.',
      })
    }

    return NextResponse.json({
      success: true,
      message: 'If an account exists for this email, we have sent a password reset link.',
    })
  } catch (error) {
    console.error('Forgot password error:', error)
    return NextResponse.json(
      {
        success: false,
        message: 'Something went wrong while sending the reset link. Please try again.',
      },
      { status: 500 },
    )
  }
}
