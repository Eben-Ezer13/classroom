import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/session'
import { prisma } from '@/lib/db'
import { messagesEnabled } from '@/lib/messages/config'
import { getClassConversation } from '@/lib/messages/access'

export async function GET() {
  if (!messagesEnabled) {
    return NextResponse.json({ error: 'Messages indisponibles.' }, { status: 404 })
  }
  const user = await getCurrentUser()
  if (!user || !user.classGroupId) {
    return NextResponse.json({ error: 'Authentification requise.' }, { status: 401 })
  }
  const context = await getClassConversation(user.id, user.classGroupId)
  if (!context) {
    return NextResponse.json({ error: 'Classe introuvable.' }, { status: 404 })
  }

  const now = new Date()
  const [announcements, deadlines] = await Promise.all([
    prisma.announcement.findMany({
      where: {
        classGroupId: context.conversation.classGroupId,
        deletedAt: null,
        ...(context.role === 'ADMIN'
          ? {}
          : {
              publishedAt: { lte: now },
              OR: [{ expiresAt: null }, { expiresAt: { gte: now } }],
            }),
      },
      select: { id: true, title: true, content: true, publishedAt: true },
      orderBy: { publishedAt: 'desc' },
      take: 30,
    }),
    prisma.deadline.findMany({
      where: {
        classGroupId: context.conversation.classGroupId,
        deletedAt: null,
        dueAt: { gte: new Date() },
      },
      select: { id: true, title: true, description: true, dueAt: true },
      orderBy: { dueAt: 'asc' },
      take: 30,
    }),
  ])
  return NextResponse.json(
    {
      announcements: announcements.map((item) => ({
        id: item.id,
        title: item.title,
        description: item.content.slice(0, 300),
        date: item.publishedAt,
      })),
      deadlines: deadlines.map((item) => ({
        id: item.id,
        title: item.title,
        description: item.description?.slice(0, 300) ?? null,
        date: item.dueAt,
      })),
    },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
