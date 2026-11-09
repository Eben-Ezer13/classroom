import 'server-only'
import Pusher from 'pusher'

export function messageChannel(conversationId: string): string {
  return `private-messages-${conversationId}`
}

function pusherClient(): Pusher {
  const appId = process.env.PUSHER_APP_ID?.trim()
  const key = process.env.NEXT_PUBLIC_PUSHER_KEY?.trim()
  const secret = process.env.PUSHER_SECRET?.trim()
  const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER?.trim()
  if (!appId || !key || !secret || !cluster) {
    throw new Error('Configuration Pusher incomplète.')
  }
  return new Pusher({ appId, key, secret, cluster, useTLS: true })
}

export function authorizeMessageChannel(socketId: string, channel: string) {
  return pusherClient().authorizeChannel(socketId, channel)
}

export async function publishMessage(
  conversationId: string,
  message: Record<string, unknown>,
): Promise<void> {
  await pusherClient().trigger(messageChannel(conversationId), 'message', message)
}
