import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { getCurrentUser } from '@/lib/auth/session'
import { prisma } from '@/lib/db'
import { messagesEnabled } from '@/lib/messages/config'
import { getClassConversation } from '@/lib/messages/access'
import { publishMessageUpdate } from '@/lib/messages/realtime'

export async function GET() {
  if (!messagesEnabled) return NextResponse.json({ error: 'Messages indisponibles.' }, { status: 404 })
  const user = await getCurrentUser()
  if (!user || !user.classGroupId) {
    return NextResponse.json({ error: 'Authentification requise.' }, { status: 401 })
  }
  const context = await getClassConversation(user.id, user.classGroupId)
  if (!context) return NextResponse.json({ error: 'Conversation introuvable.' }, { status: 404 })
  if (context.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Accès réservé au délégué.' }, { status: 403 })
  }

  const reports = await prisma.messageReport.findMany({
    where: { message: { conversationId: context.conversation.id }, status: 'OPEN' },
    select: {
      id: true,
      reason: true,
      createdAt: true,
      reporter: { select: { firstName: true, lastName: true } },
      message: {
        select: {
          id: true,
          body: true,
          author: { select: { firstName: true, lastName: true } },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
  })
  return NextResponse.json({ reports }, { headers: { 'Cache-Control': 'no-store' } })
}

const resolveSchema = z.object({ reportId: z.string().min(1).max(64) })

export async function PATCH(request: NextRequest) {
  if (!messagesEnabled) return NextResponse.json({ error: 'Messages indisponibles.' }, { status: 404 })
  const user = await getCurrentUser()
  if (!user || !user.classGroupId) {
    return NextResponse.json({ error: 'Authentification requise.' }, { status: 401 })
  }
  let input: unknown
  try {
    input = await request.json()
  } catch {
    return NextResponse.json({ error: 'Corps JSON invalide.' }, { status: 400 })
  }
  const parsed = resolveSchema.safeParse(input)
  if (!parsed.success) return NextResponse.json({ error: 'Signalement invalide.' }, { status: 400 })
  const context = await getClassConversation(user.id, user.classGroupId)
  if (!context) return NextResponse.json({ error: 'Conversation introuvable.' }, { status: 404 })
  if (context.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Action réservée au délégué.' }, { status: 403 })
  }
  const updated = await prisma.messageReport.updateMany({
    where: {
      id: parsed.data.reportId,
      status: 'OPEN',
      message: { conversationId: context.conversation.id },
    },
    data: { status: 'RESOLVED', reviewedById: user.id, reviewedAt: new Date() },
  })
  if (updated.count === 0) {
    return NextResponse.json({ error: 'Signalement introuvable.' }, { status: 404 })
  }
  await publishMessageUpdate(context.conversation.id, { type: 'reports' }).catch((error) => {
    console.error('[messages] diffusion du traitement du signalement impossible', error)
  })
  return new NextResponse(null, { status: 204 })
}
