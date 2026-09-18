import { type NextAuthConfig } from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import Google from 'next-auth/providers/google'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { PrismaMariaDb } from '@prisma/adapter-mariadb'
import { buildMariaDbConfig } from '@/lib/db-config'
import { checkRateLimit, getClientIp } from '@/lib/rate-limit'

const authSecret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET
if (!authSecret) {
  throw new Error(
    'Missing AUTH_SECRET (or NEXTAUTH_SECRET) environment variable. Set it before starting the app — refusing to fall back to an insecure default.'
  )
}

const googleClientId = process.env.GOOGLE_CLIENT_ID
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET

const signInSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
})

// Lazy Prisma import to avoid edge runtime issues
async function getPrisma() {
  if (!process.env.DATABASE_URL) {
    return {
      user: { findUnique: async () => null, create: async () => ({}), update: async () => ({}) },
      account: { findUnique: async () => null, create: async () => ({}) },
      session: { findUnique: async () => null, create: async () => ({}) },
    } as unknown as import('@prisma/client').PrismaClient
  }
  const { PrismaClient } = await import('@prisma/client')
  const databaseUrl = new URL(process.env.DATABASE_URL)
  const adapter = new PrismaMariaDb(buildMariaDbConfig(databaseUrl))
  const prisma = new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  })
  return prisma
}

export const authConfig: NextAuthConfig = {
  trustHost: true,
  secret: authSecret,
  debug: process.env.NODE_ENV === 'development',
  session: {
    strategy: 'jwt',
  },
  pages: {
    signIn: '/auth/signin',
    error: '/auth/signin',
  },
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === 'google') {
        const prisma = await getPrisma()
        const existingUser = await prisma.user.findUnique({
          where: { email: user.email! },
        })

        if (!existingUser) {
          await prisma.user.create({
            data: {
              email: user.email!,
              name: user.name,
              profileImage: user.image,
              provider: 'google',
              emailVerified: new Date(),
            },
          })
        } else if (existingUser.provider === 'credentials') {
          await prisma.user.update({
            where: { id: existingUser.id },
            data: {
              provider: 'google',
              profileImage: user.image,
              emailVerified: new Date(),
            },
          })
        }
        await prisma.$disconnect()
      }
      return true
    },
    async jwt({ token, user, account }) {
      if (user) {
        token.id = user.id
      }
      if (account) {
        token.provider = account.provider
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string
      }
      return session
    },
  },
  providers: [
    ...(googleClientId && googleClientSecret
      ? [Google({ clientId: googleClientId, clientSecret: googleClientSecret })]
      : []),
    Credentials({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials, request) {
        const validatedFields = signInSchema.safeParse(credentials)

        if (!validatedFields.success) {
          return null
        }

        const ip = getClientIp(request)
        if (!checkRateLimit(`signin:${ip}`, 10, 5 * 60 * 1000)) {
          throw new Error('Too many sign-in attempts. Please try again in a few minutes.')
        }

        const { email, password } = validatedFields.data
        const prisma = await getPrisma()

        const user = await prisma.user.findUnique({
          where: { email },
        })

        if (!user || !user.passwordHash) {
          await prisma.$disconnect()
          return null
        }

        const isPasswordValid = await bcrypt.compare(password, user.passwordHash)

        if (!isPasswordValid) {
          await prisma.$disconnect()
          return null
        }

        await prisma.$disconnect()

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.profileImage,
        }
      },
    }),
  ],
}