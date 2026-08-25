import { type NextAuthConfig } from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import Google from 'next-auth/providers/google'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { PrismaMariaDb } from '@prisma/adapter-mariadb'

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
    } as any
  }
  const { PrismaClient } = await import('@prisma/client')
  const databaseUrl = new URL(process.env.DATABASE_URL)
  const adapter = new PrismaMariaDb({
    host: databaseUrl.hostname,
    port: Number(databaseUrl.port) || 3306,
    user: decodeURIComponent(databaseUrl.username),
    password: decodeURIComponent(databaseUrl.password),
    database: databaseUrl.pathname.slice(1),
    connectionLimit: 5,
  })
  const prisma = new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  })
  return prisma
}

export const authConfig: NextAuthConfig = {
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
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      authorization: {
        params: {
          scope: 'openid email profile',
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    }),
    Credentials({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        const validatedFields = signInSchema.safeParse(credentials)

        if (!validatedFields.success) {
          return null
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