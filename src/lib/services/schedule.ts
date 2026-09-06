import 'server-only'
import { prisma } from '@/lib/db'
import { addDays, startOfDay, startOfWeek, toDateOnly } from '@/lib/utils'

/**
 * Lectures liees a l'emploi du temps.
 * La colonne `date` est de type DATE : on la compare toujours a des dates
 * normalisees a minuit UTC (toDateOnly) pour eviter tout decalage de jour.
 */

const ENTRY_SELECT = {
  id: true,
  type: true,
  title: true,
  date: true,
  startMinutes: true,
  endMinutes: true,
  room: true,
  teacherName: true,
  note: true,
  isPublished: true,
  moduleId: true,
  semesterId: true,
  module: { select: { id: true, code: true, name: true, color: true } },
} as const

export type ScheduleEntryView = Awaited<ReturnType<typeof getScheduleRange>>[number]

/** Seances d'une classe entre deux dates incluses. */
export async function getScheduleRange(
  classGroupId: string,
  from: Date,
  to: Date,
  options: { includeUnpublished?: boolean } = {},
) {
  return prisma.scheduleEntry.findMany({
    where: {
      classGroupId,
      deletedAt: null,
      ...(options.includeUnpublished ? {} : { isPublished: true }),
      date: { gte: toDateOnly(from), lte: toDateOnly(to) },
    },
    select: ENTRY_SELECT,
    orderBy: [{ date: 'asc' }, { startMinutes: 'asc' }],
  })
}

export async function getTodaySchedule(
  classGroupId: string,
  options: { includeUnpublished?: boolean } = {},
) {
  const today = startOfDay()
  return getScheduleRange(classGroupId, today, today, options)
}

/** Semaine courante (lundi -> dimanche) ou semaine decalee de `offset`. */
export async function getWeekSchedule(
  classGroupId: string,
  offset = 0,
  options: { includeUnpublished?: boolean } = {},
) {
  const monday = addDays(startOfWeek(), offset * 7)
  const sunday = addDays(monday, 6)
  const entries = await getScheduleRange(classGroupId, monday, sunday, options)
  return { monday, sunday, entries }
}

/**
 * Prochaine seance a venir : aujourd'hui apres l'heure courante, sinon le
 * prochain jour ayant une seance.
 */
export async function getNextSession(classGroupId: string) {
  const now = new Date()
  const nowMinutes = now.getHours() * 60 + now.getMinutes()
  const today = toDateOnly(now)

  const todayNext = await prisma.scheduleEntry.findFirst({
    where: {
      classGroupId,
      deletedAt: null,
      isPublished: true,
      date: today,
      endMinutes: { gt: nowMinutes },
    },
    select: ENTRY_SELECT,
    orderBy: { startMinutes: 'asc' },
  })
  if (todayNext) return todayNext

  return prisma.scheduleEntry.findFirst({
    where: {
      classGroupId,
      deletedAt: null,
      isPublished: true,
      date: { gt: today },
    },
    select: ENTRY_SELECT,
    orderBy: [{ date: 'asc' }, { startMinutes: 'asc' }],
  })
}

/** Regroupe des seances par jour (cle : AAAA-MM-JJ). */
export function groupByDay<T extends { date: Date }>(entries: T[]): Map<string, T[]> {
  const map = new Map<string, T[]>()
  for (const entry of entries) {
    const key = entry.date.toISOString().slice(0, 10)
    const bucket = map.get(key)
    if (bucket) bucket.push(entry)
    else map.set(key, [entry])
  }
  return map
}

/**
 * Detecte les chevauchements d'horaire sur une meme journee.
 * Utilise a la creation d'une seance pour prevenir le delegue.
 */
export async function findOverlaps(
  classGroupId: string,
  date: Date,
  startMinutes: number,
  endMinutes: number,
  excludeId?: string,
) {
  return prisma.scheduleEntry.findMany({
    where: {
      classGroupId,
      deletedAt: null,
      date: toDateOnly(date),
      ...(excludeId ? { id: { not: excludeId } } : {}),
      startMinutes: { lt: endMinutes },
      endMinutes: { gt: startMinutes },
    },
    select: { id: true, title: true, startMinutes: true, endMinutes: true },
  })
}
