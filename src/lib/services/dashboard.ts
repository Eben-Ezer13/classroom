import 'server-only'
import { prisma } from '@/lib/db'
import { endOfDay, startOfDay } from '@/lib/utils'
import { getNextSession, getTodaySchedule } from './schedule'

/**
 * Agregation des donnees du tableau de bord.
 * Toutes les requetes sont lancees en parallele : le rendu attend la plus
 * lente, pas leur somme.
 */

export async function getStudentDashboard(classGroupId: string, userId: string) {
  const now = new Date()

  const [
    nextSession,
    todayEntries,
    deadlines,
    resources,
    announcements,
    polls,
    votedPollIds,
  ] = await Promise.all([
    getNextSession(classGroupId),

    getTodaySchedule(classGroupId),

    prisma.deadline.findMany({
      where: { classGroupId, deletedAt: null, dueAt: { gte: startOfDay(now) } },
      select: {
        id: true,
        title: true,
        category: true,
        dueAt: true,
        module: { select: { code: true, name: true } },
      },
      orderBy: { dueAt: 'asc' },
      take: 5,
    }),

    prisma.resource.findMany({
      where: { classGroupId, deletedAt: null, isArchived: false },
      select: {
        id: true,
        title: true,
        kind: true,
        fileSize: true,
        createdAt: true,
        module: { select: { code: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
    }),

    prisma.announcement.findMany({
      where: {
        classGroupId,
        deletedAt: null,
        publishedAt: { lte: now },
        OR: [{ expiresAt: null }, { expiresAt: { gte: now } }],
      },
      select: {
        id: true,
        title: true,
        content: true,
        level: true,
        category: true,
        publishedAt: true,
        author: { select: { firstName: true, lastName: true } },
      },
      orderBy: [{ isPinned: 'desc' }, { publishedAt: 'desc' }],
      take: 4,
    }),

    prisma.poll.findMany({
      where: {
        classGroupId,
        deletedAt: null,
        closedAt: null,
        startsAt: { lte: now },
        endsAt: { gte: now },
      },
      select: {
        id: true,
        title: true,
        endsAt: true,
        allowMultiple: true,
        _count: { select: { votes: true } },
      },
      orderBy: { endsAt: 'asc' },
      take: 4,
    }),

    prisma.pollVote
      .findMany({ where: { userId }, select: { pollId: true }, distinct: ['pollId'] })
      .then((rows) => new Set(rows.map((r) => r.pollId))),
  ])

  return {
    nextSession,
    todayEntries,
    deadlines,
    resources,
    announcements,
    polls: polls.map((poll) => ({ ...poll, hasVoted: votedPollIds.has(poll.id) })),
  }
}

export async function getDelegateDashboard(classGroupId: string) {
  const now = new Date()
  const weekAgo = new Date(now.getTime() - 7 * 86_400_000)
  const inSevenDays = new Date(now.getTime() + 7 * 86_400_000)

  const [
    studentCount,
    newResources,
    activeAnnouncements,
    upcomingDeadlines,
    activePolls,
    pendingComplaints,
    todayEntries,
    recentActivity,
  ] = await Promise.all([
    prisma.membership.count({
      where: {
        classGroupId,
        role: 'MEMBER',
        isActive: true,
        user: { isActive: true, deletedAt: null },
      },
    }),

    prisma.resource.count({
      where: { classGroupId, deletedAt: null, createdAt: { gte: weekAgo } },
    }),

    prisma.announcement.count({
      where: {
        classGroupId,
        deletedAt: null,
        publishedAt: { lte: now },
        OR: [{ expiresAt: null }, { expiresAt: { gte: now } }],
      },
    }),

    prisma.deadline.count({
      where: {
        classGroupId,
        deletedAt: null,
        dueAt: { gte: now, lte: inSevenDays },
      },
    }),

    prisma.poll.count({
      where: {
        classGroupId,
        deletedAt: null,
        closedAt: null,
        startsAt: { lte: now },
        endsAt: { gte: now },
      },
    }),

    prisma.complaint.count({
      where: { classGroupId, deletedAt: null, status: 'EN_ATTENTE' },
    }),

    getTodaySchedule(classGroupId, { includeUnpublished: true }),

    prisma.auditLog.findMany({
      where: { classGroupId },
      select: {
        id: true,
        actorLabel: true,
        summary: true,
        action: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 8,
    }),
  ])

  return {
    studentCount,
    newResources,
    activeAnnouncements,
    upcomingDeadlines,
    activePolls,
    pendingComplaints,
    todayEntries,
    recentActivity,
  }
}

/** Compteurs d'echeances utilises par la page dediee et le tableau de bord. */
export async function getDeadlineBuckets(classGroupId: string) {
  const now = new Date()
  const endToday = endOfDay(now)
  const inSevenDays = new Date(now.getTime() + 7 * 86_400_000)
  const inThirtyDays = new Date(now.getTime() + 30 * 86_400_000)

  const [today, week, month, overdue] = await Promise.all([
    prisma.deadline.count({
      where: { classGroupId, deletedAt: null, dueAt: { gte: now, lte: endToday } },
    }),
    prisma.deadline.count({
      where: { classGroupId, deletedAt: null, dueAt: { gte: now, lte: inSevenDays } },
    }),
    prisma.deadline.count({
      where: { classGroupId, deletedAt: null, dueAt: { gte: now, lte: inThirtyDays } },
    }),
    prisma.deadline.count({
      where: { classGroupId, deletedAt: null, dueAt: { lt: now } },
    }),
  ])

  return { today, week, month, overdue }
}
