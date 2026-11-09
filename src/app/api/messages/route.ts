import { after, NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { getCurrentUser } from '@/lib/auth/session'
import { prisma } from '@/lib/db'
import { hitRateLimit, rateLimitKey } from '@/lib/rate-limit'
import { messagesEnabled } from '@/lib/messages/config'
import { getClassConversation } from '@/lib/messages/access'
import { publishMessage } from '@/lib/messages/realtime'
import { sendPushToUsers } from '@/lib/push'

const sendMessageSchema = z.object({
  conversationId: z.string().min(1).max(64),
  body: z.string().trim().min(1).max(2000),
  replyToId: z.string().max(64).nullable().optional(),
  mentionedUserIds: z.array(z.string().min(1).max(64)).max(100).default([]),
})

const SEND_LIMIT = { limit: 20, windowSeconds: 60 }

function containsMention(body: string, firstName: string): boolean {
  const escapedName = firstName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`(?:^|\\s)@${escapedName}(?=$|[\\s.,!?])`, 'iu').test(body)
}

function disabled() {
  return NextResponse.json({ error: 'Messages indisponibles.' }, { status: 404 })
}

export async function GET(request: NextRequest) {
  if (!messagesEnabled) return disabled()
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Authentification requise.' }, { status: 401 })

  const requestedConversationId = request.nextUrl.searchParams.get('conversationId')
  const context = await getClassConversation(
    user.id,
    user.classGroupId,
    requestedConversationId,
  )
  if (!context) return NextResponse.json({ error: 'Conversation introuvable.' }, { status: 404 })

  const messages = await prisma.message.findMany({
    where: { conversationId: context.conversation.id },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: 50,
    select: {
      id: true,
      conversationId: true,
      authorId: true,
      replyToId: true,
      body: true,
      createdAt: true,
      author: { select: { firstName: true, lastName: true } },
      mentions: {
        select: {
          userId: true,
          user: { select: { firstName: true, lastName: true } },
        },
      },
      replyTo: {
        select: {
          id: true,
          body: true,
          author: { select: { firstName: true, lastName: true } },
        },
      },
    },
  })

  const targetMessageId = request.nextUrl.searchParams.get('messageId')
  const targetMessage = targetMessageId
    ? await prisma.message.findFirst({
        where: { id: targetMessageId, conversationId: context.conversation.id },
        select: {
          id: true,
          conversationId: true,
          authorId: true,
          replyToId: true,
          body: true,
          createdAt: true,
          author: { select: { firstName: true, lastName: true } },
          mentions: {
            select: {
              userId: true,
              user: { select: { firstName: true, lastName: true } },
            },
          },
          replyTo: {
            select: {
              id: true,
              body: true,
              author: { select: { firstName: true, lastName: true } },
            },
          },
        },
      })
    : null
  if (targetMessageId && !targetMessage) {
    return NextResponse.json({ error: 'Message introuvable.' }, { status: 404 })
  }

  const sortedMessages = [
    ...new Map(
      [...messages, ...(targetMessage ? [targetMessage] : [])].map((message) => [
        message.id,
        message,
      ]),
    ).values(),
  ].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())

  const unreadIds = sortedMessages
    .filter((message) => message.authorId !== user.id)
    .map((message) => ({ messageId: message.id, userId: user.id }))
  if (unreadIds.length > 0) {
    await prisma.messageRead.createMany({ data: unreadIds, skipDuplicates: true })
  }

  const unreadCount = await prisma.message.count({
    where: {
      conversationId: context.conversation.id,
      authorId: { not: user.id },
      reads: { none: { userId: user.id } },
    },
  })
  const members = await prisma.membership.findMany({
    where: {
      classGroupId: context.conversation.classGroupId,
      isActive: true,
      user: { isActive: true, deletedAt: null },
    },
    select: {
      userId: true,
      role: true,
      user: { select: { firstName: true, lastName: true } },
    },
    orderBy: [{ role: 'asc' }, { user: { firstName: 'asc' } }],
  })

  return NextResponse.json(
    {
      conversationId: context.conversation.id,
      messages: sortedMessages.map((message) => ({
        ...message,
        mentionAll: /(?:^|\s)@tous(?:$|\s|[.,!?])/i.test(message.body),
      })),
      members,
      unreadCount,
    },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}

export async function POST(request: NextRequest) {
  if (!messagesEnabled) return disabled()
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Authentification requise.' }, { status: 401 })

  let input: unknown
  try {
    input = await request.json()
  } catch {
    return NextResponse.json({ error: 'Corps JSON invalide.' }, { status: 400 })
  }
  const parsed = sendMessageSchema.safeParse(input)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Message invalide.' }, { status: 400 })
  }

  const limit = await hitRateLimit(
    rateLimitKey('message-send', user.id),
    SEND_LIMIT,
  )
  if (limit.limited) {
    return NextResponse.json(
      { error: 'Trop de messages envoyés. Réessaie plus tard.' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } },
    )
  }

  const { conversationId, body, replyToId } = parsed.data
  const context = await getClassConversation(user.id, user.classGroupId, conversationId)
  if (!context) return NextResponse.json({ error: 'Conversation introuvable.' }, { status: 404 })

  const mentionedUserIds = [...new Set(parsed.data.mentionedUserIds)]
  const mentionAll = /(?:^|\s)@tous(?:$|\s|[.,!?])/i.test(body)
  if (mentionAll && context.role !== 'ADMIN') {
    return NextResponse.json(
      { error: 'Seul le délégué peut mentionner toute la classe.' },
      { status: 403 },
    )
  }

  const activeMembers = await prisma.membership.findMany({
    where: {
      classGroupId: context.conversation.classGroupId,
      isActive: true,
      user: { isActive: true, deletedAt: null },
    },
    select: {
      userId: true,
      user: { select: { firstName: true, lastName: true } },
    },
  })
  const selectedMembers = activeMembers.filter((member) => mentionedUserIds.includes(member.userId))
  if (selectedMembers.length !== mentionedUserIds.length) {
    return NextResponse.json({ error: 'Un membre mentionné n’appartient plus à la classe.' }, { status: 400 })
  }
  if (
    !mentionAll &&
    selectedMembers.some(
      (member) => !containsMention(body, member.user.firstName),
    )
  ) {
    return NextResponse.json({ error: 'Le texte ne correspond pas aux mentions sélectionnées.' }, { status: 400 })
  }

  const mentionTargets = (mentionAll ? activeMembers : selectedMembers)
    .filter((member) => member.userId !== user.id)
  const mentionTargetIds = mentionTargets.map((member) => member.userId)

  if (replyToId) {
    const replyTarget = await prisma.message.findFirst({
      where: { id: replyToId, conversationId: context.conversation.id },
      select: { id: true },
    })
    if (!replyTarget) {
      return NextResponse.json({ error: 'Message de réponse introuvable.' }, { status: 404 })
    }
  }

  const message = await prisma.$transaction(async (tx) => {
    const savedMessage = await tx.message.create({
      data: {
        conversationId: context.conversation.id,
        authorId: user.id,
        body,
        replyToId: replyToId ?? null,
        mentions: {
          createMany: { data: mentionTargetIds.map((userId) => ({ userId })) },
        },
      },
      select: {
        id: true,
        conversationId: true,
        authorId: true,
        replyToId: true,
        body: true,
        createdAt: true,
        author: { select: { firstName: true, lastName: true } },
        mentions: {
          select: {
            userId: true,
            user: { select: { firstName: true, lastName: true } },
          },
        },
      },
    })

    if (mentionTargets.length > 0) {
      const messageUrl = `/messages?messageId=${encodeURIComponent(savedMessage.id)}`
      await tx.notification.createMany({
        data: mentionTargets.map((member) => ({
          userId: member.userId,
          classGroupId: context.conversation.classGroupId,
          type: 'MENTION',
          title: `${user.firstName} ${user.lastName} vous a mentionné`,
          body: body.slice(0, 160),
          url: messageUrl,
          entityType: 'Message',
          entityId: savedMessage.id,
        })),
      })
    }

    return savedMessage
  })
  const event = { ...message, mentionAll }

  if (mentionTargetIds.length > 0) {
    after(async () => {
      try {
        const unread = await prisma.notification.groupBy({
          by: ['userId'],
          where: {
            userId: { in: mentionTargetIds },
            classGroupId: context.conversation.classGroupId,
            readAt: null,
          },
          _count: { _all: true },
        })
        const unreadCounts = Object.fromEntries(
          unread.map((row) => [row.userId, row._count._all]),
        )
        await sendPushToUsers(
          mentionTargetIds,
          {
            title: `${user.firstName} ${user.lastName} vous a mentionné`,
            body: 'Ouvre Classroom pour consulter le message.',
            url: `/messages?messageId=${encodeURIComponent(message.id)}`,
            tag: `message-mention-${message.id}`,
          },
          unreadCounts,
        )
      } catch (error) {
        console.error('[messages] notification push de mention impossible', error)
      }
    })
  }

  let realtimeWarning: string | null = null
  try {
    await publishMessage(context.conversation.id, event)
  } catch (error) {
    console.error('[messages] diffusion temps réel impossible', error)
    realtimeWarning = 'Message enregistré, mais la diffusion temps réel a échoué. Actualise le chat.'
  }

  return NextResponse.json({ message: event, realtimeWarning }, { status: 201 })
}
