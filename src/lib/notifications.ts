import 'server-only'
import { prisma } from '@/lib/db'
import type { NotificationType, Prisma } from '@prisma/client'
import { canSendMail, sendMail } from '@/lib/mailer'
import { env } from '@/lib/env'

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
type ActiveMember = {
  userId: string
  email: string
  emailAlerts: boolean
}

async function activeMembers(
  classGroupId: string,
  options: { excludeUserId?: string; onlyAdmins?: boolean } = {},
): Promise<ActiveMember[]> {
  const memberships = await prisma.membership.findMany({
    where: {
      classGroupId,
      isActive: true,
      ...(options.onlyAdmins ? { role: 'ADMIN' } : {}),
      ...(options.excludeUserId ? { userId: { not: options.excludeUserId } } : {}),
      user: { isActive: true, deletedAt: null },
    },
    select: {
      userId: true,
      user: { select: { email: true, emailAlerts: true } },
    },
  })
  return memberships.map((membership) => ({
    userId: membership.userId,
    email: membership.user.email,
    emailAlerts: membership.user.emailAlerts,
  }))
}

/**
 * L'e-mail prolonge la notification interne ; il ne la remplace jamais.
 * Les echecs d'envoi sont journalises sans jamais invalider une publication.
 */
async function sendAlertEmails(members: ActiveMember[], payload: NotifyPayload): Promise<void> {
  if (!canSendMail()) return

  const recipients = members.filter((member) => member.emailAlerts)
  if (recipients.length === 0) return

  const link = `${env.appUrl}${payload.url ?? '/dashboard'}`
  const text = [
    payload.title,
    '',
    payload.body ?? 'Une mise à jour a été publiée dans votre classe.',
    '',
    `Consulter Classroom : ${link}`,
    '',
    'Vous recevez cet e-mail car vous avez activé les alertes dans votre profil.',
  ].join('\n')

  const results = await Promise.allSettled(
    recipients.map((member) =>
      sendMail({
        to: member.email,
        subject: `[Classroom] ${payload.title}`,
        text,
      }),
    ),
  )

  for (const result of results) {
    if (result.status === 'rejected') {
      console.error('[notifications] e-mail d’alerte impossible', result.reason)
    }
  }
}

/** Notifie tous les membres actifs d'une classe, sauf l'auteur de l'action. */
export async function notifyClass(
  classGroupId: string,
  payload: NotifyPayload,
  options: { excludeUserId?: string } = {},
): Promise<number> {
  try {
    const members = await activeMembers(classGroupId, options)
    if (members.length === 0) return 0
    const ids = members.map((member) => member.userId)
    await prisma.notification.createMany({ data: rows(ids, classGroupId, payload) })
    await sendAlertEmails(members, payload)
    return ids.length
  } catch (error) {
    // Une notification est un effet secondaire : elle ne doit jamais faire
    // croire que la creation d'un cours, document ou projet a echoue.
    console.error('[notifications] diffusion de classe impossible', error)
    return 0
  }
}

/** Notifie un utilisateur precis, dans le contexte d'une classe. */
export async function notifyUser(
  userId: string,
  payload: NotifyPayload,
  classGroupId: string | null = null,
): Promise<void> {
  try {
    await prisma.notification.create({ data: rows([userId], classGroupId, payload)[0] })
  } catch (error) {
    console.error('[notifications] notification utilisateur impossible', error)
  }
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
  try {
    if (userIds.length === 0) return 0
    const allowed = await activeMembers(classGroupId, options)
    const allowedById = new Map(allowed.map((member) => [member.userId, member]))
    const targets = [...new Set(userIds)].filter((id) => allowedById.has(id))
    if (targets.length === 0) return 0
    await prisma.notification.createMany({ data: rows(targets, classGroupId, payload) })
    await sendAlertEmails(
      targets.flatMap((id) => {
        const member = allowedById.get(id)
        return member ? [member] : []
      }),
      payload,
    )
    return targets.length
  } catch (error) {
    console.error('[notifications] diffusion ciblee impossible', error)
    return 0
  }
}

/** Notifie les delegues d'une classe. */
export async function notifyClassStaff(
  classGroupId: string,
  payload: NotifyPayload,
  options: { excludeUserId?: string } = {},
): Promise<void> {
  try {
    const members = await activeMembers(classGroupId, { ...options, onlyAdmins: true })
    if (members.length === 0) return
    const ids = members.map((member) => member.userId)
    await prisma.notification.createMany({ data: rows(ids, classGroupId, payload) })
  } catch (error) {
    console.error('[notifications] diffusion aux delegues impossible', error)
  }
}

/**
 * Perimetre des notifications visibles : celles de la classe ouverte et
 * celles qui ne dependent d'aucune classe (retrait d'une classe...). Le
 * compteur, la liste et "tout marquer comme lu" partagent ce perimetre.
 */
export function notificationScope(
  userId: string,
  classGroupId?: string | null,
): Prisma.NotificationWhereInput {
  return {
    userId,
    ...(classGroupId ? { OR: [{ classGroupId }, { classGroupId: null }] } : {}),
  }
}

/** Notifications non lues de l'espace ouvert (badge de la barre laterale). */
export async function unreadCount(
  userId: string,
  classGroupId?: string | null,
): Promise<number> {
  return prisma.notification.count({
    where: { ...notificationScope(userId, classGroupId), readAt: null },
  })
}
