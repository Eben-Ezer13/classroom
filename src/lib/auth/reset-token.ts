import 'server-only'
import { createHash, randomBytes } from 'crypto'
import { prisma } from '@/lib/db'

/**
 * Jetons de reinitialisation du mot de passe.
 *
 * Seule l'empreinte SHA-256 est stockee : une fuite de la base ne permet
 * pas d'utiliser un lien en cours de validite. Un nouveau lien invalide les
 * precedents non utilises.
 */

export function hashResetToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

/** Cree un jeton pour ce compte et renvoie sa valeur en clair (a envoyer). */
export async function issuePasswordResetToken(userId: string, ttlMs: number): Promise<string> {
  const token = randomBytes(32).toString('base64url')
  await prisma.$transaction([
    prisma.passwordResetToken.deleteMany({ where: { userId, usedAt: null } }),
    prisma.passwordResetToken.create({
      data: {
        userId,
        tokenHash: hashResetToken(token),
        expiresAt: new Date(Date.now() + ttlMs),
      },
    }),
  ])
  return token
}
