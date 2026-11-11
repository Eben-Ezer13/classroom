import 'server-only'
import { prisma } from '@/lib/db'
import { canAccessConversation } from './policy.mjs'

export async function getClassConversation(
  userId: string,
  classGroupId: string | null,
  requestedConversationId?: string | null,
) {
  if (!classGroupId) return null

  const membership = await prisma.membership.findFirst({
    where: {
      userId,
      classGroupId,
      isActive: true,
      user: { isActive: true, deletedAt: null },
      classGroup: { isActive: true, deletedAt: null },
    },
    select: {
      userId: true,
      classGroupId: true,
      role: true,
      isActive: true,
      user: { select: { isActive: true, deletedAt: true } },
      classGroup: { select: { isActive: true, deletedAt: true } },
    },
  })
  if (!membership) return null

  const conversation = await prisma.conversation.upsert({
    where: { classGroupId },
    create: { classGroupId },
    update: {},
    select: { id: true, classGroupId: true },
  })
  if (
    !canAccessConversation(
      membership,
      userId,
      classGroupId,
      conversation,
      requestedConversationId,
    )
  ) {
    return null
  }

  const members = await prisma.membership.findMany({
    where: {
      classGroupId,
      isActive: true,
      user: { isActive: true, deletedAt: null },
    },
    select: { userId: true },
  })
  await prisma.conversationMember.createMany({
    data: members.map((member) => ({
      conversationId: conversation.id,
      userId: member.userId,
    })),
    skipDuplicates: true,
  })

  return { conversation, role: membership.role }
}

export async function unreadMessageCount(
  userId: string,
  classGroupId: string | null,
): Promise<number> {
  if (!classGroupId) return 0

  const membership = await prisma.membership.findFirst({
    where: {
      userId,
      classGroupId,
      isActive: true,
      user: { isActive: true, deletedAt: null },
      classGroup: { isActive: true, deletedAt: null },
    },
    select: { id: true },
  })
  if (!membership) return 0

  const conversation = await prisma.conversation.findUnique({
    where: { classGroupId },
    select: { id: true },
  })
  if (!conversation) return 0

  return prisma.message.count({
    where: {
      conversationId: conversation.id,
      authorId: { not: userId },
      reads: { none: { userId } },
    },
  })
}
