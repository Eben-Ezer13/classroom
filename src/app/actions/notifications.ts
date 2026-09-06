'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/db'
import { requireUser } from '@/lib/auth/guards'

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

  await prisma.notification.updateMany({
    where: { userId: user.id, readAt: null },
    data: { readAt: new Date() },
  })

  revalidatePath('/notifications')
  revalidatePath('/dashboard')
}

export async function deleteNotificationAction(formData: FormData): Promise<void> {
  const user = await requireUser()
  const notificationId = String(formData.get('notificationId') ?? '')

  await prisma.notification.deleteMany({
    where: { id: notificationId, userId: user.id },
  })

  revalidatePath('/notifications')
}
