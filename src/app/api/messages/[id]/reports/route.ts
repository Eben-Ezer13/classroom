import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { getCurrentUser } from '@/lib/auth/session'
import { prisma } from '@/lib/db'
import { hitRateLimit, rateLimitKey } from '@/lib/rate-limit'
import { messagesEnabled } from '@/lib/messages/config'
import { getClassConversation } from '@/lib/messages/access'
import { publishMessageUpdate } from '@/lib/messages/realtime'

const reportSchema = z.object({
  reason: z.string().trim().min(3).max(500),
})

const REPORT_LIMIT = { limit: 5, windowSeconds: 60 * 60 }

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!messagesEnabled) return NextResponse.json({ error: 'Messages indisponibles.' }, { status: 404 })
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Authentification requise.' }, { status: 401 })
  let input: unknown
  try {
    input = await request.json()
  } catch {
    return NextResponse.json({ error: 'Corps JSON invalide.' }, { status: 400 })
  }
  const parsed = reportSchema.safeParse(input)
  if (!parsed.success) return NextResponse.json({ error: 'Motif de signalement invalide.' }, { status: 400 })

  const limit = await hitRateLimit(rateLimitKey('message-report', user.id), REPORT_LIMIT)
  if (limit.limited) {
    return NextResponse.json(
      { error: 'Trop de signalements. Réessaie plus tard.' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } },
    )
  }
  const { id } = await params
  const message = await prisma.message.findUnique({
    where: { id },
    select: {
      conversationId: true,
      conversation: { select: { classGroupId: true } },
    },
  })
  if (!message) return NextResponse.json({ error: 'Message introuvable.' }, { status: 404 })
  const context = await getClassConversation(user.id, user.classGroupId, message.conversationId)
  if (!context || context.conversation.classGroupId !== message.conversation.classGroupId) {
    return NextResponse.json({ error: 'Message introuvable.' }, { status: 404 })
  }
  const existing = await prisma.messageReport.findFirst({
    where: { messageId: id, reporterId: user.id, status: 'OPEN' },
    select: { id: true },
  })
  if (existing) {
    return NextResponse.json({ error: 'Tu as déjà signalé ce message.' }, { status: 409 })
  }

  await prisma.$transaction(async (tx) => {
    await tx.messageReport.create({
      data: { messageId: id, reporterId: user.id, reason: parsed.data.reason },
    })
    const delegates = await tx.membership.findMany({
      where: {
        classGroupId: context.conversation.classGroupId,
        role: 'ADMIN',
        isActive: true,
        user: { isActive: true, deletedAt: null },
      },
      select: { userId: true },
    })
    const notifications = delegates
      .filter((delegate) => delegate.userId !== user.id)
      .map((delegate) => ({
        userId: delegate.userId,
        classGroupId: context.conversation.classGroupId,
        type: 'SYSTEME' as const,
        title: 'Un message a été signalé',
        body: parsed.data.reason.slice(0, 160),
        url: '/messages?reports=1',
        entityType: 'Message',
        entityId: id,
      }))
    if (notifications.length > 0) {
      await tx.notification.createMany({ data: notifications })
    }
  })
  await publishMessageUpdate(message.conversationId, { type: 'reports' }).catch((error) => {
    console.error('[messages] diffusion du signalement impossible', error)
  })
  return NextResponse.json({ reported: true }, { status: 201 })
}
