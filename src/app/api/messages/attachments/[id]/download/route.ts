import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/session'
import { messagesEnabled } from '@/lib/messages/config'
import { getClassConversation } from '@/lib/messages/access'
import { prisma } from '@/lib/db'
import { streamStoredFile } from '@/lib/storage/response'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!messagesEnabled) {
    return NextResponse.json({ error: 'Messages indisponibles.' }, { status: 404 })
  }
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: 'Authentification requise.' }, { status: 401 })
  }

  const { id } = await params
  const attachment = await prisma.messageAttachment.findUnique({
    where: { id },
    select: {
      storageKey: true,
      fileName: true,
      mimeType: true,
      message: {
        select: {
          conversationId: true,
          conversation: { select: { classGroupId: true } },
        },
      },
    },
  })
  if (!attachment) {
    return NextResponse.json({ error: 'Fichier introuvable.' }, { status: 404 })
  }

  const context = await getClassConversation(
    user.id,
    user.classGroupId,
    attachment.message.conversationId,
  )
  if (!context || context.conversation.classGroupId !== attachment.message.conversation.classGroupId) {
    return NextResponse.json({ error: 'Fichier introuvable.' }, { status: 404 })
  }

  const inline =
    (attachment.mimeType.startsWith('image/') &&
      !/image\/hei[cf]/i.test(attachment.mimeType)) ||
    attachment.mimeType.startsWith('video/')
  return streamStoredFile(
    {
      filePath: attachment.storageKey,
      fileName: attachment.fileName,
      mimeType: attachment.mimeType,
    },
    { disposition: inline ? 'inline' : 'attachment', logLabel: 'message-attachment' },
  )
}
