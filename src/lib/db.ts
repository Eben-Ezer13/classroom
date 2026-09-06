import 'server-only'
import { PrismaClient } from '@prisma/client'

/**
 * Singleton Prisma.
 * En developpement Next.js recharge les modules a chaque edition : sans ce
 * cache global on ouvrirait une nouvelle pool de connexions a chaque HMR,
 * ce qui epuise rapidement le quota de connexions Neon.
 */

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  })

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}
