import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { getCurrentUser } from '@/lib/auth/session'
import { prisma } from '@/lib/db'
import { messagesEnabled } from '@/lib/messages/config'
import { getClassConversation } from '@/lib/messages/access'
import { publishMessageUpdate } from '@/lib/messages/realtime'
import { discardStoredFiles, trackClassStorage } from '@/lib/storage'

const pinSchema = z.object({ action: z.literal('pin') })

async function loadAuthorizedMessage(id: string, userId: string, classGroupId: string | null) {
  const message = await prisma.message.findUnique({
    where: { id },
    select: {
      id: true,
      authorId: true,
      conversationId: true,
      conversation: { select: { classGroupId: true } },
      pins: { select: { id: true } },
      attachments: {
        select: { storageKey: true, fileName: true, fileSize: true, mimeType: true },
      },
    },
  })
  if (!message) return null
  const context = await getClassConversation(userId, classGroupId, message.conversationId)
  if (!context || context.conversation.classGroupId !== message.conversation.classGroupId) return null
  return { message, context }
}

export async function PATCH(
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
  if (!pinSchema.safeParse(input).success) {
    return NextResponse.json({ error: 'Action de message invalide.' }, { status: 400 })
  }
  const { id } = await params
  const result = await loadAuthorizedMessage(id, user.id, user.classGroupId)
  if (!result) return NextResponse.json({ error: 'Message introuvable.' }, { status: 404 })
  if (result.context.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Seul le délégué peut épingler un message.' }, { status: 403 })
  }

  const existing = result.message.pins[0]
  if (existing) {
    await prisma.messagePin.delete({ where: { id: existing.id } })
  } else {
    await prisma.messagePin.create({
      data: { messageId: id, pinnedById: user.id },
    })
  }
  await publishMessageUpdate(result.message.conversationId, { type: 'refresh' }).catch((error) => {
    console.error('[messages] diffusion de l’épinglage impossible', error)
  })
  return NextResponse.json({ pinned: !existing })
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!messagesEnabled) return NextResponse.json({ error: 'Messages indisponibles.' }, { status: 404 })
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Authentification requise.' }, { status: 401 })
  const { id } = await params
  const result = await loadAuthorizedMessage(id, user.id, user.classGroupId)
  if (!result || result.message.authorId !== user.id) {
    return NextResponse.json({ error: 'Message introuvable.' }, { status: 404 })
  }

  await prisma.$transaction(async (tx) => {
    await tx.notification.deleteMany({
      where: { entityType: 'Message', entityId: id },
    })
    await tx.message.delete({ where: { id } })
  })
  await discardStoredFiles(
    result.message.attachments.map((file) => ({
      filePath: file.storageKey,
      fileName: file.fileName,
      fileSize: file.fileSize,
      mimeType: file.mimeType,
    })),
  )
  const bytes = result.message.attachments.reduce((sum, file) => sum + file.fileSize, 0)
  if (bytes > 0) await trackClassStorage(result.context.conversation.classGroupId, -bytes)
  await publishMessageUpdate(result.message.conversationId, { type: 'refresh' }).catch((error) => {
    console.error('[messages] diffusion de la suppression impossible', error)
  })
  return new NextResponse(null, { status: 204 })
}
