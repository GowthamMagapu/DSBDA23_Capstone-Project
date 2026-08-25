import { PrismaClient } from '@prisma/client'
import { PrismaMariaDb } from '@prisma/adapter-mariadb'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function createPrismaClient() {
  if (!process.env.DATABASE_URL) {
    return {
      user: {
        findUnique: async () => null,
        create: async () => ({}),
        update: async () => ({}),
      },
      account: {
        findUnique: async () => null,
        create: async () => ({}),
      },
      session: {
        findUnique: async () => null,
        create: async () => ({}),
      },
    } as unknown as PrismaClient
  }

  // Check if we're in edge runtime (middleware)
  const isEdgeRuntime = typeof process !== 'undefined' && process.env.NEXT_RUNTIME === 'edge'

  if (isEdgeRuntime) {
    // For edge runtime, we can't use Prisma directly
    // Return a mock or use a different approach
    return {
      user: {
        findUnique: async () => null,
        create: async () => ({}),
        update: async () => ({}),
      },
      account: {
        findUnique: async () => null,
        create: async () => ({}),
      },
      session: {
        findUnique: async () => null,
        create: async () => ({}),
      },
    } as unknown as PrismaClient
  }

  const databaseUrl = new URL(process.env.DATABASE_URL)
  const adapter = new PrismaMariaDb({
    host: databaseUrl.hostname,
    port: Number(databaseUrl.port) || 3306,
    user: decodeURIComponent(databaseUrl.username),
    password: decodeURIComponent(databaseUrl.password),
    database: databaseUrl.pathname.slice(1),
    connectionLimit: 5,
  })

  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  })
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

// Helper for edge runtime
export function getPrisma() {
  if (!process.env.DATABASE_URL) {
    return {
      user: { findUnique: async () => null, create: async () => ({}), update: async () => ({}) },
      account: { findUnique: async () => null, create: async () => ({}) },
      session: { findUnique: async () => null, create: async () => ({}) },
    } as unknown as PrismaClient
  }
  const databaseUrl = new URL(process.env.DATABASE_URL)
  const adapter = new PrismaMariaDb({
    host: databaseUrl.hostname,
    port: Number(databaseUrl.port) || 3306,
    user: decodeURIComponent(databaseUrl.username),
    password: decodeURIComponent(databaseUrl.password),
    database: databaseUrl.pathname.slice(1),
    connectionLimit: 5,
  })

  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  })
}