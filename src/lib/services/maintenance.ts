import 'server-only'
import { prisma } from '@/lib/db'
import { notifyClass } from '@/lib/notifications'
import { DEADLINE_CATEGORY_LABELS } from '@/lib/constants'
import { formatDateTime } from '@/lib/utils'

/**
 * Taches periodiques, declenchees par le Cron Vercel (/api/cron/reminders).
 *
 * Volontairement HORS d'un fichier 'use server' : toute fonction exportee
 * d'un tel fichier devient une Server Action appelable depuis le reseau,
 * sans passer par le controle du CRON_SECRET.
 */

/**
 * Envoie les rappels d'echeance dus. Idempotent grace au drapeau
 * `reminderSent` : un second passage n'envoie rien de plus.
 */
export async function dispatchDeadlineReminders(): Promise<number> {
  const now = new Date()

  const due = await prisma.deadline.findMany({
    where: {
      deletedAt: null,
      reminderSent: false,
      reminderAt: { not: null, lte: now },
      dueAt: { gte: now },
    },
    select: {
      id: true,
      classGroupId: true,
      title: true,
      category: true,
      dueAt: true,
    },
    orderBy: { dueAt: 'asc' },
    take: 200,
  })

  let sent = 0
  for (const deadline of due) {
    // Le drapeau est pose AVANT l'envoi et de maniere conditionnelle : deux
    // executions concurrentes ne notifient jamais deux fois la classe.
    const claimed = await prisma.deadline.updateMany({
      where: { id: deadline.id, reminderSent: false },
      data: { reminderSent: true },
    })
    if (claimed.count === 0) continue

    await notifyClass(deadline.classGroupId, {
      type: 'DEADLINE',
      title: 'Rappel d’échéance',
      body: `${DEADLINE_CATEGORY_LABELS[deadline.category]} : ${deadline.title} — ${formatDateTime(deadline.dueAt)}.`,
      url: '/echeances',
      entityType: 'Deadline',
      entityId: deadline.id,
    })
    sent += 1
  }

  return sent
}

/**
 * Purge des lignes techniques expirees : sessions, jetons de
 * reinitialisation et compteurs de limitation. Sans elle, ces tables ne
 * feraient que grossir.
 */
export async function purgeExpiredRecords() {
  const now = new Date()
  const dayAgo = new Date(now.getTime() - 86_400_000)

  const [sessions, resetTokens, rateLimits] = await Promise.all([
    prisma.session.deleteMany({ where: { expiresAt: { lt: now } } }),
    prisma.passwordResetToken.deleteMany({
      where: { OR: [{ expiresAt: { lt: dayAgo } }, { usedAt: { lt: dayAgo } }] },
    }),
    prisma.rateLimit.deleteMany({ where: { expiresAt: { lt: now } } }).catch((error) => {
      // Table absente tant que la migration n'est pas appliquee.
      console.error('[maintenance] purge des limites impossible', error)
      return { count: 0 }
    }),
  ])

  return {
    sessions: sessions.count,
    resetTokens: resetTokens.count,
    rateLimits: rateLimits.count,
  }
}
