import 'server-only'
import webPush from 'web-push'
import { prisma } from '@/lib/db'

export type PushPayload = {
  title: string
  body?: string | null
  url?: string | null
  unreadCount?: number
  tag?: string
}

function vapidConfig() {
  const publicKey = process.env.VAPID_PUBLIC_KEY?.trim()
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim()
  const subject = process.env.VAPID_SUBJECT?.trim()
  if (!publicKey || !privateKey || !subject) return null
  return { publicKey, privateKey, subject }
}

export function getPushPublicKey(): string | null {
  return vapidConfig()?.publicKey ?? null
}

/** Envoie aux appareils inscrits, en nettoyant les abonnements révoqués. */
export async function sendPushToUsers(
  userIds: string[],
  payload: PushPayload,
  unreadCounts: Record<string, number> = {},
): Promise<void> {
  const config = vapidConfig()
  if (!config || userIds.length === 0) return

  webPush.setVapidDetails(config.subject, config.publicKey, config.privateKey)
  const subscriptions = await prisma.pushSubscription.findMany({
    where: { userId: { in: [...new Set(userIds)] } },
    select: { id: true, userId: true, endpoint: true, p256dh: true, auth: true },
  })

  const results = await Promise.allSettled(
    subscriptions.map(async (subscription) => {
      try {
        await webPush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: { p256dh: subscription.p256dh, auth: subscription.auth },
          },
          JSON.stringify({
            ...payload,
            unreadCount: unreadCounts[subscription.userId] ?? payload.unreadCount,
          }),
          { TTL: 60 * 60, urgency: 'normal' },
        )
      } catch (error) {
        const statusCode =
          typeof error === 'object' && error !== null && 'statusCode' in error
            ? Number((error as { statusCode?: unknown }).statusCode)
            : 0
        if (statusCode === 404 || statusCode === 410) {
          await prisma.pushSubscription.deleteMany({ where: { id: subscription.id } })
          return
        }
        throw error
      }
    }),
  )

  for (const result of results) {
    if (result.status === 'rejected') {
      console.error('[push] envoi de notification impossible', result.reason)
    }
  }
}
