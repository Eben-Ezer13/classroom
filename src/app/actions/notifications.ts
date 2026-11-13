'use server'

import { prisma } from '@/lib/db'
import { requireUser } from '@/lib/auth/guards'
import { notificationScope } from '@/lib/notifications'
import { sendPushToUsers } from '@/lib/push'

/**
 * Les notifications appartiennent a un utilisateur : chaque requete filtre
 * sur `userId`, donc personne ne peut marquer comme lue la notification
 * d'un autre en changeant un identifiant.
 */

export async function markNotificationReadAction(formData: FormData): Promise<void> {
  const user = await requireUser()
  const notificationId = String(formData.get('notificationId') ?? '')

  await prisma.notification.updateMany({
    where: { id: notificationId, userId: user.id, readAt: null },
    data: { readAt: new Date() },
  })

}

export async function markAllNotificationsReadAction(): Promise<void> {
  const user = await requireUser()

  // Meme perimetre que la liste affichee : les notifications d'une autre
  // classe ne sont pas marquees lues a l'insu de l'utilisateur.
  await prisma.notification.updateMany({
    where: { ...notificationScope(user.id, user.classGroupId), readAt: null },
    data: { readAt: new Date() },
  })

}

export async function deleteNotificationAction(formData: FormData): Promise<void> {
  const user = await requireUser()
  const notificationId = String(formData.get('notificationId') ?? '')

  await prisma.notification.deleteMany({
    where: { id: notificationId, userId: user.id },
  })

}

/** Envoie une notification de vérification à l'utilisateur connecté. */
export async function sendPushTestAction(): Promise<{ ok: boolean; error?: string }> {
  const user = await requireUser()
  const subscriptionCount = await prisma.pushSubscription.count({ where: { userId: user.id } })
  if (subscriptionCount === 0) {
    return { ok: false, error: 'Aucun appareil n’est activé pour les notifications. Active-les d’abord sur cet appareil.' }
  }

  await sendPushToUsers([user.id], {
    title: 'Test de notification Classroom',
    body: 'Si tu vois ce message, les notifications push fonctionnent sur cet appareil.',
    url: '/profil',
    tag: `classroom-push-test-${user.id}`,
  })
  return { ok: true }
}
