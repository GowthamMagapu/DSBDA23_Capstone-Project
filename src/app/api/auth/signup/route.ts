import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { z } from 'zod'

const signUpSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const validatedFields = signUpSchema.safeParse(body)

    if (!validatedFields.success) {
      return NextResponse.json(
        { errors: validatedFields.error.flatten().fieldErrors, message: 'Please fix the errors below' },
        { status: 400 }
      )
    }

    const { name, email, password } = validatedFields.data

    const existingUser = await prisma.user.findUnique({
      where: { email },
    })

    if (existingUser) {
      return NextResponse.json(
        { errors: { email: ['An account with this email already exists'] }, message: 'Registration failed' },
        { status: 400 }
      )
    }

    const passwordHash = await bcrypt.hash(password, 12)

    await prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
        provider: 'credentials',
      },
    })

    return NextResponse.json({ success: true, message: 'Account created successfully' })
  } catch (error) {
    console.error('Signup error:', error)
    return NextResponse.json(
      { errors: { _form: ['Something went wrong. Please try again.'] }, message: 'Registration failed' },
      { status: 500 }
    )
  }
}