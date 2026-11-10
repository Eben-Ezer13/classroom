import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { getCurrentUser } from '@/lib/auth/session'
import { prisma } from '@/lib/db'
import { messagesEnabled } from '@/lib/messages/config'
import { getClassConversation } from '@/lib/messages/access'
import { publishMessageUpdate } from '@/lib/messages/realtime'
import { isMessageReactionEmoji } from '@/lib/messages/constants'

const reactionSchema = z.object({ emoji: z.string().refine(isMessageReactionEmoji) })

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
  const parsed = reactionSchema.safeParse(input)
  if (!parsed.success) return NextResponse.json({ error: 'Réaction invalide.' }, { status: 400 })
  const { id } = await params
  const message = await prisma.message.findUnique({
    where: { id },
    select: { conversationId: true, conversation: { select: { classGroupId: true } } },
  })
  if (!message) return NextResponse.json({ error: 'Message introuvable.' }, { status: 404 })
  const context = await getClassConversation(user.id, user.classGroupId, message.conversationId)
  if (!context || context.conversation.classGroupId !== message.conversation.classGroupId) {
    return NextResponse.json({ error: 'Message introuvable.' }, { status: 404 })
  }

  const existing = await prisma.messageReaction.findUnique({
    where: {
      messageId_userId_emoji: { messageId: id, userId: user.id, emoji: parsed.data.emoji },
    },
    select: { id: true },
  })
  if (existing) await prisma.messageReaction.delete({ where: { id: existing.id } })
  else {
    await prisma.messageReaction.create({
      data: { messageId: id, userId: user.id, emoji: parsed.data.emoji },
    })
  }
  await publishMessageUpdate(message.conversationId, { type: 'refresh' }).catch((error) => {
    console.error('[messages] diffusion de la réaction impossible', error)
  })
  return NextResponse.json({ active: !existing })
}
