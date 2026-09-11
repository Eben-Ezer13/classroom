import 'server-only'
import { createHash } from 'crypto'
import { headers } from 'next/headers'
import { prisma } from '@/lib/db'

/**
 * Limitation de debit a fenetre fixe, stockee dans PostgreSQL.
 *
 * Une table plutot qu'un compteur en memoire : sur Vercel chaque instance a
 * sa propre memoire et repart de zero a chaque demarrage a froid, ce qui
 * rendrait la limite inoperante.
 *
 * Choix de disponibilite : si la base refuse la requete (table absente avant
 * `prisma migrate deploy`, surcharge...), la limite est ignoree et l'erreur
 * journalisee. Un incident de limitation ne doit jamais empecher toute une
 * classe de se connecter.
 */

export type RateLimitRule = {
  /** Nombre d'essais autorises dans la fenetre. */
  limit: number
  windowSeconds: number
}

export type RateLimitStatus = {
  limited: boolean
  /** Secondes avant la fin de la fenetre courante. */
  retryAfterSeconds: number
}

const OPEN: RateLimitStatus = { limited: false, retryAfterSeconds: 0 }

/** Empreinte d'un identifiant (email...) : la table ne stocke rien de lisible. */
export function rateLimitKey(scope: string, value: string): string {
  const digest = createHash('sha256').update(value.trim().toLowerCase()).digest('hex')
  return `${scope}:${digest.slice(0, 40)}`
}

/**
 * Adresse IP du client. Sur Vercel, x-forwarded-for est reecrit par la
 * plateforme et ne peut pas etre falsifie par le navigateur.
 */
export async function clientIp(): Promise<string | null> {
  const h = await headers()
  const forwarded = h.get('x-forwarded-for')
  const ip = forwarded ? forwarded.split(',')[0].trim() : h.get('x-real-ip')?.trim()
  return ip || null
}

function secondsUntil(date: Date, now: Date): number {
  return Math.max(1, Math.ceil((date.getTime() - now.getTime()) / 1000))
}

/** Consulte un compteur sans l'incrementer. */
export async function peekRateLimit(key: string, rule: RateLimitRule): Promise<RateLimitStatus> {
  try {
    const now = new Date()
    const row = await prisma.rateLimit.findUnique({
      where: { key },
      select: { count: true, expiresAt: true },
    })
    if (!row || row.expiresAt <= now || row.count < rule.limit) return OPEN
    return { limited: true, retryAfterSeconds: secondsUntil(row.expiresAt, now) }
  } catch (error) {
    console.error('[rate-limit] lecture impossible', error)
    return OPEN
  }
}

/**
 * Compte un essai et indique si la limite est depassee. L'increment est
 * atomique (INSERT ... ON CONFLICT) : deux requetes simultanees ne peuvent
 * pas lire le meme compteur.
 */
export async function hitRateLimit(key: string, rule: RateLimitRule): Promise<RateLimitStatus> {
  try {
    const now = new Date()
    const expiresAt = new Date(now.getTime() + rule.windowSeconds * 1000)
    let row = await prisma.rateLimit.upsert({
      where: { key },
      create: { key, count: 1, expiresAt },
      update: { count: { increment: 1 } },
      select: { count: true, expiresAt: true },
    })
    if (row.expiresAt <= now) {
      // Fenetre expiree : le compteur repart de un.
      await prisma.rateLimit.updateMany({
        where: { key, expiresAt: { lte: now } },
        data: { count: 1, expiresAt },
      })
      row = { count: 1, expiresAt }
    }
    return row.count > rule.limit
      ? { limited: true, retryAfterSeconds: secondsUntil(row.expiresAt, now) }
      : OPEN
  } catch (error) {
    console.error('[rate-limit] écriture impossible', error)
    return OPEN
  }
}

/** Remet un compteur a zero (connexion reussie par exemple). */
export async function clearRateLimit(key: string): Promise<void> {
  await prisma.rateLimit.deleteMany({ where: { key } }).catch(() => {})
}

/** "dans 12 minutes" / "dans 40 secondes", pour les messages d'erreur. */
export function formatRetryAfter(seconds: number): string {
  if (seconds < 90) return `${seconds} seconde${seconds > 1 ? 's' : ''}`
  const minutes = Math.ceil(seconds / 60)
  return `${minutes} minute${minutes > 1 ? 's' : ''}`
}

/**
 * Regles appliquees. Les limites par adresse IP restent larges : une classe
 * entiere se connecte souvent depuis le meme reseau d'etablissement.
 */
export const RATE_LIMITS = {
  loginPerEmail: { limit: 8, windowSeconds: 15 * 60 },
  loginPerIp: { limit: 60, windowSeconds: 15 * 60 },
  resetPerEmail: { limit: 3, windowSeconds: 60 * 60 },
  resetPerIp: { limit: 20, windowSeconds: 60 * 60 },
  registerPerIp: { limit: 100, windowSeconds: 60 * 60 },
  uploadPerUser: { limit: 60, windowSeconds: 10 * 60 },
} satisfies Record<string, RateLimitRule>
