'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/db'
import { requireUser } from '@/lib/auth/guards'
import { notificationScope } from '@/lib/notifications'

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

  revalidatePath('/notifications')
}

export async function markAllNotificationsReadAction(): Promise<void> {
  const user = await requireUser()

  // Meme perimetre que la liste affichee : les notifications d'une autre
  // classe ne sont pas marquees lues a l'insu de l'utilisateur.
  await prisma.notification.updateMany({
    where: { ...notificationScope(user.id, user.classGroupId), readAt: null },
    data: { readAt: new Date() },
  })

  revalidatePath('/', 'layout')
}

export async function deleteNotificationAction(formData: FormData): Promise<void> {
  const user = await requireUser()
  const notificationId = String(formData.get('notificationId') ?? '')

  await prisma.notification.deleteMany({
    where: { id: notificationId, userId: user.id },
  })

  revalidatePath('/notifications')
}
