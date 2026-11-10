import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { getCurrentUser } from '@/lib/auth/session'
import { hitRateLimit, rateLimitKey } from '@/lib/rate-limit'
import { messagesEnabled } from '@/lib/messages/config'
import { getClassConversation } from '@/lib/messages/access'
import { publishTyping } from '@/lib/messages/realtime'

const typingSchema = z.object({
  conversationId: z.string().min(1).max(64),
  isTyping: z.boolean(),
})

const TYPING_LIMIT = { limit: 30, windowSeconds: 60 }

export async function POST(request: NextRequest) {
  if (!messagesEnabled) {
    return NextResponse.json({ error: 'Messages indisponibles.' }, { status: 404 })
  }

  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: 'Authentification requise.' }, { status: 401 })
  }

  let input: unknown
  try {
    input = await request.json()
  } catch {
    return NextResponse.json({ error: 'Corps JSON invalide.' }, { status: 400 })
  }
  const parsed = typingSchema.safeParse(input)
  if (!parsed.success) {
    return NextResponse.json({ error: 'État de saisie invalide.' }, { status: 400 })
  }

  const context = await getClassConversation(
    user.id,
    user.classGroupId,
    parsed.data.conversationId,
  )
  if (!context) {
    return NextResponse.json({ error: 'Conversation introuvable.' }, { status: 404 })
  }

  const limit = await hitRateLimit(
    rateLimitKey('message-typing', user.id),
    TYPING_LIMIT,
  )
  if (limit.limited) {
    return NextResponse.json(
      { error: 'Trop de mises à jour de saisie.' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } },
    )
  }

  try {
    await publishTyping(context.conversation.id, {
      userId: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      avatarUrl: user.avatarUrl ? `/api/users/${user.id}/avatar` : null,
      isTyping: parsed.data.isTyping,
    })
  } catch (error) {
    console.error('[messages] diffusion de saisie impossible', error)
    return NextResponse.json(
      { error: 'Le service temps réel est momentanément indisponible.' },
      { status: 503 },
    )
  }

  return new NextResponse(null, { status: 204 })
}
