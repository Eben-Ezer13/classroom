import 'server-only'
import { prisma } from '@/lib/db'
import type { NotificationType } from '@prisma/client'

/**
 * Diffusion des notifications.
 *
 * Une notification est materialisee par destinataire (fan-out a l'ecriture) :
 * la lecture du compteur "non lus" devient un simple count indexe, ce qui est
 * le bon compromis pour une classe (quelques dizaines de membres).
 *
 * Chaque ligne porte la classe d'origine : un utilisateur membre de
 * plusieurs classes ne voit que les notifications de l'espace ouvert.
 */

type NotifyPayload = {
  type: NotificationType
  title: string
  body?: string | null
  url?: string | null
  entityType?: string | null
  entityId?: string | null
}

function rows(
  userIds: string[],
  classGroupId: string | null,
  payload: NotifyPayload,
) {
  return userIds.map((userId) => ({
    userId,
    classGroupId,
    type: payload.type,
    title: payload.title,
    body: payload.body ?? null,
    url: payload.url ?? null,
    entityType: payload.entityType ?? null,
    entityId: payload.entityId ?? null,
  }))
}

/** Membres actifs d'une classe. Source unique : la table d'appartenance. */
async function activeMemberIds(
  classGroupId: string,
  options: { excludeUserId?: string; onlyAdmins?: boolean } = {},
): Promise<string[]> {
  const memberships = await prisma.membership.findMany({
    where: {
      classGroupId,
      isActive: true,
      ...(options.onlyAdmins ? { role: 'ADMIN' } : {}),
      ...(options.excludeUserId ? { userId: { not: options.excludeUserId } } : {}),
      user: { isActive: true, deletedAt: null },
    },
    select: { userId: true },
  })
  return memberships.map((m) => m.userId)
}

/** Notifie tous les membres actifs d'une classe, sauf l'auteur de l'action. */
export async function notifyClass(
  classGroupId: string,
  payload: NotifyPayload,
  options: { excludeUserId?: string } = {},
): Promise<number> {
  const ids = await activeMemberIds(classGroupId, options)
  if (ids.length === 0) return 0
  await prisma.notification.createMany({ data: rows(ids, classGroupId, payload) })
  return ids.length
}

/** Notifie un utilisateur precis, dans le contexte d'une classe. */
export async function notifyUser(
  userId: string,
  payload: NotifyPayload,
  classGroupId: string | null = null,
): Promise<void> {
  await prisma.notification.create({ data: rows([userId], classGroupId, payload)[0] })
}

/**
 * Notifie une liste de membres (mentions).
 * Les identifiants sont refiltres sur l'appartenance a la classe : meme si
 * l'appelant se trompait, personne d'exterieur ne recevrait la notification.
 */
export async function notifyMembers(
  classGroupId: string,
  userIds: string[],
  payload: NotifyPayload,
  options: { excludeUserId?: string } = {},
): Promise<number> {
  if (userIds.length === 0) return 0
  const allowed = new Set(await activeMemberIds(classGroupId, options))
  const targets = [...new Set(userIds)].filter((id) => allowed.has(id))
  if (targets.length === 0) return 0
  await prisma.notification.createMany({ data: rows(targets, classGroupId, payload) })
  return targets.length
}

/** Notifie les delegues d'une classe. */
export async function notifyClassStaff(
  classGroupId: string,
  payload: NotifyPayload,
  options: { excludeUserId?: string } = {},
): Promise<void> {
  const ids = await activeMemberIds(classGroupId, { ...options, onlyAdmins: true })
  if (ids.length === 0) return
  await prisma.notification.createMany({ data: rows(ids, classGroupId, payload) })
}

/**
 * Notifications non lues.
 * Bornees a la classe active quand elle est fournie : le compteur affiche
 * dans la barre laterale correspond a l'espace ouvert.
 */
export async function unreadCount(
  userId: string,
  classGroupId?: string | null,
): Promise<number> {
  return prisma.notification.count({
    where: {
      userId,
      readAt: null,
      ...(classGroupId ? { OR: [{ classGroupId }, { classGroupId: null }] } : {}),
    },
  })
}
