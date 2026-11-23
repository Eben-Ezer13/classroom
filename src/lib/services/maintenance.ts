import 'server-only'
import { prisma } from '@/lib/db'
import { notifyClass } from '@/lib/notifications'
import { DEADLINE_CATEGORY_LABELS } from '@/lib/constants'
import { formatDateTime } from '@/lib/utils'

const REMINDER_TIMEZONE = 'Africa/Casablanca'

function localClock(date: Date) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: REMINDER_TIMEZONE,
    weekday: 'short', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(date)
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return {
    day: `${values.year}-${values.month}-${values.day}`,
    weekday: values.weekday,
    hour: Number(values.hour),
    minute: Number(values.minute),
  }
}

async function deliverOnce(classGroupId: string, reminderKey: string, title: string, body: string, url: string, entityType: string, entityId: string) {
  try {
    await prisma.reminderDelivery.create({ data: { classGroupId, reminderKey } })
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') return false
    throw error
  }
  await notifyClass(classGroupId, { type: 'DEADLINE', title, body, url, entityType, entityId })
  return true
}

/** Rappels d'examens quotidiens et de projets, basés sur l'heure de Casablanca. */
export async function dispatchScheduledReminders(): Promise<number> {
  const now = new Date()
  const clock = localClock(now)
  const minuteOfDay = clock.hour * 60 + clock.minute
  let sent = 0

  const exams = await prisma.exam.findMany({
    where: { deletedAt: null, startsAt: { gt: now } },
    select: { id: true, classGroupId: true, title: true, startsAt: true },
    orderBy: { startsAt: 'asc' }, take: 500,
  })
  const slots = new Map([[510, '08h30'], [1110, '18h30'], [1320, '22h00']])
  const slot = slots.get(minuteOfDay)
  if (slot) {
    for (const exam of exams) {
      const left = Math.ceil((exam.startsAt.getTime() - now.getTime()) / 86_400_000)
      const wasSent = await deliverOnce(
        exam.classGroupId, `exam:${exam.id}:${clock.day}:${slot}`,
        `Compte à rebours · ${exam.title}`,
        left <= 0 ? `${exam.title} commence aujourd’hui.` : `${exam.title} dans ${left} jour${left > 1 ? 's' : ''} — ${formatDateTime(exam.startsAt)}.`,
        '/examens', 'Exam', exam.id,
      )
      if (wasSent) sent += 1
    }
  }

  const projects = await prisma.project.findMany({
    where: { deletedAt: null, dueAt: { gt: now } },
    select: { id: true, classGroupId: true, title: true, dueAt: true },
    orderBy: { dueAt: 'asc' }, take: 500,
  })
  // Message de rappel chaque lundi matin pour les projets encore à rendre.
  if (clock.weekday === 'Mon' && minuteOfDay === 510) {
    for (const project of projects) {
      if (await deliverOnce(
        project.classGroupId, `project:${project.id}:weekly:${clock.day}`,
        'Rappel hebdomadaire de projet',
        `${project.title} — échéance le ${formatDateTime(project.dueAt)}.`,
        '/projets', 'Project', project.id,
      )) sent += 1
    }
  }

  // Les appels cron peuvent arriver avec quelques minutes de retard.
  for (const project of projects) {
    for (const hours of [5, 1]) {
      const triggerAt = project.dueAt.getTime() - hours * 60 * 60 * 1000
      if (now.getTime() < triggerAt || now.getTime() >= triggerAt + 5 * 60 * 1000) continue
      if (await deliverOnce(
        project.classGroupId, `project:${project.id}:${hours}h`,
        `Échéance dans ${hours} h`,
        `${project.title} est à rendre le ${formatDateTime(project.dueAt)}.`,
        '/projets', 'Project', project.id,
      )) sent += 1
    }
  }
  return sent
}

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

  const [sessions, resetTokens, rateLimits, reminderDeliveries] = await Promise.all([
    prisma.session.deleteMany({ where: { expiresAt: { lt: now } } }),
    prisma.passwordResetToken.deleteMany({
      where: { OR: [{ expiresAt: { lt: dayAgo } }, { usedAt: { lt: dayAgo } }] },
    }),
    prisma.rateLimit.deleteMany({ where: { expiresAt: { lt: now } } }).catch((error) => {
      // Table absente tant que la migration n'est pas appliquee.
      console.error('[maintenance] purge des limites impossible', error)
      return { count: 0 }
    }),
    prisma.reminderDelivery.deleteMany({ where: { sentAt: { lt: new Date(now.getTime() - 90 * 86_400_000) } } }),
  ])

  return {
    sessions: sessions.count,
    resetTokens: resetTokens.count,
    rateLimits: rateLimits.count,
    reminderDeliveries: reminderDeliveries.count,
  }
}
