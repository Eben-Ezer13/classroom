import { after, NextResponse, type NextRequest } from 'next/server'
import type { Prisma } from '@prisma/client'
import { z } from 'zod'
import { getCurrentUser } from '@/lib/auth/session'
import { prisma } from '@/lib/db'
import { AppError } from '@/lib/errors'
import { hitRateLimit, rateLimitKey } from '@/lib/rate-limit'
import { messagesEnabled } from '@/lib/messages/config'
import { getClassConversation } from '@/lib/messages/access'
import { canManageMessages } from '@/lib/messages/policy.mjs'
import { publishMessage } from '@/lib/messages/realtime'
import { sendPushToUsers } from '@/lib/push'
import {
  assertClassQuota,
  discardStoredFiles,
  receiveUploads,
  trackClassStorage,
  type StoredFile,
} from '@/lib/storage'
import { UPLOAD_RULES, directUploadField } from '@/lib/uploads'

const sendMessageSchema = z.object({
  conversationId: z.string().min(1).max(64),
  body: z.string().trim().max(2000).default(''),
  replyToId: z.string().max(64).nullable().optional(),
  mentionedUserIds: z.array(z.string().min(1).max(64)).max(100).default([]),
  sharedEntity: z
    .object({
      type: z.enum(['announcement', 'deadline']),
      id: z.string().min(1).max(64),
    })
    .nullable()
    .optional(),
  sharedLink: z
    .object({
      url: z
        .string()
        .url()
        .max(2048)
        .refine((value) => {
          try {
            const url = new URL(value)
            return (
              ['http:', 'https:'].includes(url.protocol) &&
              !url.username &&
              !url.password
            )
          } catch {
            return false
          }
        }),
      title: z.string().trim().min(1).max(120),
      description: z.string().trim().max(300).nullable().optional(),
    })
    .nullable()
    .optional(),
})
const directUploadRefSchema = z.object({ url: z.string().url(), name: z.string().min(1).max(180) })

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

  const beforeMessageId = request.nextUrl.searchParams.get('beforeMessageId')
  const afterMessageId = request.nextUrl.searchParams.get('afterMessageId')
  if (beforeMessageId && afterMessageId) {
    return NextResponse.json({ error: 'Un seul curseur de pagination est accepté.' }, { status: 400 })
  }

  if (request.nextUrl.searchParams.get('attachments') === '1') {
    const query = request.nextUrl.searchParams.get('q')?.trim().slice(0, 100) ?? ''
    const attachments = await prisma.messageAttachment.findMany({
      where: {
        message: { conversationId: context.conversation.id },
        ...(query ? { fileName: { contains: query, mode: 'insensitive' } } : {}),
      },
      select: {
        id: true,
        fileName: true,
        mimeType: true,
        fileSize: true,
        createdAt: true,
        message: {
          select: {
            id: true,
            body: true,
            createdAt: true,
            author: { select: { firstName: true, lastName: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    })
    return NextResponse.json(
      { attachments },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  }

  const cursorId = beforeMessageId ?? afterMessageId
  const cursorMessage = cursorId
    ? await prisma.message.findFirst({
        where: { id: cursorId, conversationId: context.conversation.id },
        select: { id: true, createdAt: true },
      })
    : null
  if (cursorId && !cursorMessage) {
    return NextResponse.json({ error: 'Curseur de message introuvable.' }, { status: 404 })
  }

  let messageWhere: Prisma.MessageWhereInput = {
    conversationId: context.conversation.id,
  }
  if (beforeMessageId && cursorMessage) {
    messageWhere = {
      ...messageWhere,
      OR: [
        { createdAt: { lt: cursorMessage.createdAt } },
        { createdAt: cursorMessage.createdAt, id: { lt: cursorMessage.id } },
      ],
    }
  } else if (afterMessageId && cursorMessage) {
    messageWhere = {
      ...messageWhere,
      OR: [
        { createdAt: { gt: cursorMessage.createdAt } },
        { createdAt: cursorMessage.createdAt, id: { gt: cursorMessage.id } },
      ],
    }
  }

  const queriedMessages = await prisma.message.findMany({
    where: messageWhere,
    orderBy: beforeMessageId
      ? [{ createdAt: 'desc' }, { id: 'desc' }]
      : [{ createdAt: afterMessageId ? 'asc' : 'desc' }, { id: afterMessageId ? 'asc' : 'desc' }],
    take: 51,
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
      attachments: {
        select: { id: true, fileName: true, mimeType: true, fileSize: true },
        orderBy: { createdAt: 'asc' },
      },
      linkPreview: { select: { url: true, title: true, description: true } },
      sharedItem: {
        select: {
          shareType: true,
          entityId: true,
          title: true,
          description: true,
          url: true,
        },
      },
      reactions: { select: { userId: true, emoji: true } },
      pins: { select: { id: true, pinnedById: true } },
    },
  })
  const hasMoreOlder = !afterMessageId && queriedMessages.length > 50
  const hasMoreNewer = Boolean(afterMessageId && queriedMessages.length > 50)
  const messages = queriedMessages.slice(0, 50)

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
          attachments: {
            select: { id: true, fileName: true, mimeType: true, fileSize: true },
            orderBy: { createdAt: 'asc' },
          },
          linkPreview: { select: { url: true, title: true, description: true } },
          sharedItem: {
            select: {
              shareType: true,
              entityId: true,
              title: true,
              description: true,
              url: true,
            },
          },
          reactions: { select: { userId: true, emoji: true } },
          pins: { select: { id: true, pinnedById: true } },
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
  ].sort(
    (a, b) =>
      a.createdAt.getTime() - b.createdAt.getTime() ||
      a.id.localeCompare(b.id),
  )

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
      user: { select: { firstName: true, lastName: true, avatarUrl: true } },
    },
    orderBy: [{ role: 'asc' }, { user: { firstName: 'asc' } }],
  })
  const pinnedMessages = await prisma.messagePin.findMany({
    where: { message: { conversationId: context.conversation.id } },
    select: {
      message: {
        select: {
          id: true,
          body: true,
          createdAt: true,
          author: { select: { firstName: true, lastName: true } },
          sharedItem: { select: { title: true } },
          linkPreview: { select: { title: true } },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 10,
  })

  return NextResponse.json(
    {
      conversationId: context.conversation.id,
      hasMoreOlder,
      hasMoreNewer,
      messages: sortedMessages.map((message) => ({
        ...message,
        mentionAll: /(?:^|\s)@tous(?:$|\s|[.,!?])/i.test(message.body),
      })),
      pinnedMessages: pinnedMessages.map(({ message }) => message),
      members: members.map((member) => ({
        ...member,
        user: {
          ...member.user,
          avatarUrl: member.user.avatarUrl ? `/api/users/${member.userId}/avatar` : null,
        },
      })),
      unreadCount,
    },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}

export async function POST(request: NextRequest) {
  if (!messagesEnabled) return disabled()
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Authentification requise.' }, { status: 401 })

  const isMultipart = request.headers.get('content-type')?.includes('multipart/form-data')
  let formData: FormData | null = null
  let input: unknown
  try {
    if (isMultipart) {
      formData = await request.formData()
      const readJsonField = (name: string): unknown => {
        const value = formData?.get(name)
        if (typeof value !== 'string' || value.length === 0) return undefined
        return JSON.parse(value) as unknown
      }
      input = {
        conversationId: formData.get('conversationId'),
        body: formData.get('body'),
        replyToId: formData.get('replyToId') || null,
        mentionedUserIds: readJsonField('mentionedUserIds') ?? [],
        sharedLink: readJsonField('sharedLink') ?? null,
        sharedEntity: readJsonField('sharedEntity') ?? null,
      }
    } else {
      input = await request.json()
    }
  } catch {
    return NextResponse.json({ error: 'Corps de message invalide.' }, { status: 400 })
  }
  const parsed = sendMessageSchema.safeParse(input)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Message invalide.' }, { status: 400 })
  }
  const attachmentFiles = formData?.getAll('attachments')
    .filter((file): file is File => file instanceof File && file.size > 0) ?? []
  const rawRefs = formData?.getAll(directUploadField('attachments')) ?? []
  const refs = rawRefs.map((value) => {
    if (typeof value !== 'string') return null
    try {
      return directUploadRefSchema.safeParse(JSON.parse(value))
    } catch {
      return null
    }
  })
  if (
    attachmentFiles.length + refs.length > UPLOAD_RULES.message.maxFiles ||
    refs.some((ref) => !ref?.success)
  ) {
    return NextResponse.json(
      { error: `Ajoute au maximum ${UPLOAD_RULES.message.maxFiles} fichiers valides.` },
      { status: 400 },
    )
  }
  const { conversationId, body, replyToId, sharedLink, sharedEntity } = parsed.data
  if (sharedLink && sharedEntity) {
    return NextResponse.json({ error: 'Choisis un seul type de contenu à partager.' }, { status: 400 })
  }
  if (!body && !sharedLink && !sharedEntity && attachmentFiles.length + refs.length === 0) {
    return NextResponse.json({ error: 'Écris un message ou ajoute un contenu à partager.' }, { status: 400 })
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

  const context = await getClassConversation(user.id, user.classGroupId, conversationId)
  if (!context) return NextResponse.json({ error: 'Conversation introuvable.' }, { status: 404 })

  const mentionedUserIds = [...new Set(parsed.data.mentionedUserIds)]
  const mentionAll = /(?:^|\s)@tous(?:$|\s|[.,!?])/i.test(body)
  if (mentionAll && !canManageMessages(context.role)) {
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

  let sharedEntitySnapshot: {
    title: string
    description: string | null
    url: string
  } | null = null
  if (sharedEntity?.type === 'announcement') {
    const now = new Date()
    const announcement = await prisma.announcement.findFirst({
      where: {
        id: sharedEntity.id,
        classGroupId: context.conversation.classGroupId,
        deletedAt: null,
        ...(context.role === 'ADMIN'
          ? {}
          : {
              publishedAt: { lte: now },
              OR: [{ expiresAt: null }, { expiresAt: { gte: now } }],
            }),
      },
      select: { id: true, title: true, content: true },
    })
    if (!announcement) {
      return NextResponse.json({ error: 'Annonce introuvable dans cette classe.' }, { status: 404 })
    }
    sharedEntitySnapshot = {
      title: announcement.title,
      description: announcement.content.slice(0, 300),
      url: `/annonces?partage=${encodeURIComponent(announcement.id)}`,
    }
  } else if (sharedEntity?.type === 'deadline') {
    const deadline = await prisma.deadline.findFirst({
      where: {
        id: sharedEntity.id,
        classGroupId: context.conversation.classGroupId,
        deletedAt: null,
      },
      select: { id: true, title: true, description: true, dueAt: true },
    })
    if (!deadline) {
      return NextResponse.json({ error: 'Échéance introuvable dans cette classe.' }, { status: 404 })
    }
    sharedEntitySnapshot = {
      title: deadline.title,
      description: deadline.description
        ? `${deadline.description.slice(0, 230)} · À rendre le ${deadline.dueAt.toLocaleDateString('fr-FR')}`
        : `À rendre le ${deadline.dueAt.toLocaleDateString('fr-FR')}`,
      url: `/echeances?partage=${encodeURIComponent(deadline.id)}`,
    }
  }

  if (replyToId) {
    const replyTarget = await prisma.message.findFirst({
      where: { id: replyToId, conversationId: context.conversation.id },
      select: { id: true },
    })
    if (!replyTarget) {
      return NextResponse.json({ error: 'Message de réponse introuvable.' }, { status: 404 })
    }
  }

  let uploadedFiles: StoredFile[] = []
  try {
    if (formData) {
      uploadedFiles = await receiveUploads(formData, {
        field: 'attachments',
        kind: 'message',
        classGroupId: context.conversation.classGroupId,
        userId: user.id,
      })
    }
    const incomingBytes = uploadedFiles.reduce((sum, file) => sum + file.fileSize, 0)
    if (incomingBytes > 0) {
      await assertClassQuota(context.conversation.classGroupId, incomingBytes)
    }
  } catch (error) {
    await discardStoredFiles(uploadedFiles)
    if (error instanceof AppError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    throw error
  }

  const message = await prisma.$transaction(async (tx) => {
    const savedMessage = await tx.message.create({
      data: {
        conversationId: context.conversation.id,
        authorId: user.id,
        body,
        replyToId: replyToId ?? null,
        attachments: {
          create: uploadedFiles.map((file) => ({
            uploadedById: user.id,
            storageKey: file.filePath,
            fileName: file.fileName,
            mimeType: file.mimeType,
            fileSize: file.fileSize,
          })),
        },
        ...(sharedLink
          ? {
              linkPreview: {
                create: {
                  url: sharedLink.url,
                  title: sharedLink.title,
                  description: sharedLink.description || null,
                },
              },
            }
          : {}),
        ...(sharedEntity && sharedEntitySnapshot
          ? {
              sharedItem: {
                create: {
                  shareType: sharedEntity.type,
                  entityId: sharedEntity.id,
                  title: sharedEntitySnapshot.title,
                  description: sharedEntitySnapshot.description,
                  url: sharedEntitySnapshot.url,
                },
              },
            }
          : {}),
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
        attachments: {
          select: { id: true, fileName: true, mimeType: true, fileSize: true },
          orderBy: { createdAt: 'asc' },
        },
        linkPreview: { select: { url: true, title: true, description: true } },
        sharedItem: {
          select: {
            shareType: true,
            entityId: true,
            title: true,
            description: true,
            url: true,
          },
        },
        reactions: { select: { userId: true, emoji: true } },
        pins: { select: { id: true, pinnedById: true } },
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
  }).catch(async (error: unknown) => {
    await discardStoredFiles(uploadedFiles)
    throw error
  })
  if (uploadedFiles.length > 0) {
    await trackClassStorage(
      context.conversation.classGroupId,
      uploadedFiles.reduce((sum, file) => sum + file.fileSize, 0),
    )
  }
  const event = { ...message, mentionAll }
  const messageAuthor = `${user.firstName} ${user.lastName}`
  const pushMessageBody =
    message.body.trim().slice(0, 160) ||
    (message.sharedItem
      ? `Contenu partagé : ${message.sharedItem.title}`
      : message.linkPreview
        ? `Lien partagé : ${message.linkPreview.title}`
        : message.attachments.length > 0
          ? `Pièce jointe : ${message.attachments[0].fileName}`
          : 'Nouveau message dans le chat de classe.')
  const otherMemberIds = activeMembers
    .map((member) => member.userId)
    .filter((userId) => userId !== user.id && !mentionTargetIds.includes(userId))

  if (otherMemberIds.length > 0) {
    after(async () => {
      try {
        const unread = await prisma.notification.groupBy({
          by: ['userId'],
          where: {
            userId: { in: otherMemberIds },
            classGroupId: context.conversation.classGroupId,
            readAt: null,
          },
          _count: { _all: true },
        })
        const unreadCounts = Object.fromEntries(unread.map((row) => [row.userId, row._count._all]))
        await sendPushToUsers(
          otherMemberIds,
          {
            title: `Nouveau message de ${messageAuthor}`,
            body: pushMessageBody,
            url: `/messages?messageId=${encodeURIComponent(message.id)}`,
            tag: `message-${message.id}`,
          },
          unreadCounts,
        )
      } catch (error) {
        console.error('[messages] notification push de message impossible', error)
      }
    })
  }

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
            body: pushMessageBody,
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
