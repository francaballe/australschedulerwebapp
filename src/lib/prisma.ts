import { PrismaClient } from '@prisma/client'
import { buildDatabaseUrl } from './database-url'

// Ensure DATABASE_URL is set before creating Prisma client
if (!process.env.DATABASE_URL) {
  try {
    process.env.DATABASE_URL = buildDatabaseUrl()
  } catch (error) {
    console.error('Failed to build DATABASE_URL:', (error as Error).message)
    throw error
  }
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma = globalForPrisma.prisma ?? new PrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma