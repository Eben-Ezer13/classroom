'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/db'
import { requireClassAdmin } from '@/lib/auth/guards'
import {
  assertCanManageClass,
  assertModuleInClass,
  requireManagedClassId,
} from '@/lib/permissions'
import { recordAudit } from '@/lib/audit'
import { notifyClass, notifyMembers } from '@/lib/notifications'
import { runAction, NotFoundError, type ActionState } from '@/lib/errors'
import { announcementSchema, parseForm } from '@/lib/validation'
import { ANNOUNCEMENT_LEVEL_LABELS } from '@/lib/constants'
import { truncate } from '@/lib/utils'

/**
 * Annonces de classe, avec mention de membres.
 *
 * Une mention designe un compte reel : les identifiants recus sont
 * reconfrontes a la liste des membres de la classe avant d'etre
 * enregistres. Mentionner quelqu'un d'une autre classe est donc impossible,
 * meme en modifiant le formulaire.
 */

/** Ne conserve que les identifiants correspondant a des membres actifs. */
async function resolveMentions(
  classGroupId: string,
  userIds: string[],
): Promise<string[]> {
  if (userIds.length === 0) return []
  const members = await prisma.membership.findMany({
    where: {
      classGroupId,
      isActive: true,
      userId: { in: [...new Set(userIds)] },
      user: { isActive: true, deletedAt: null },
    },
    select: { userId: true },
  })
  return members.map((m) => m.userId)
}

export async function createAnnouncementAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    const { user } = await requireClassAdmin()
    const parsed = parseForm(announcementSchema, formData, ['mentionedUserIds'])
    if (!parsed.success) {
      return { ok: false, message: parsed.message, fieldErrors: parsed.fieldErrors }
    }
    const data = parsed.data
    const classGroupId = requireManagedClassId(user, data.classGroupId)
    await assertModuleInClass(data.moduleId, classGroupId)

    const mentioned = await resolveMentions(classGroupId, data.mentionedUserIds)

    const created = await prisma.announcement.create({
      data: {
        classGroupId,
        moduleId: data.moduleId ?? null,
        title: data.title,
        content: data.content,
        level: data.level,
        category: data.category,
        isPinned: data.isPinned,
        mentionsAll: data.mentionsAll,
        expiresAt: data.expiresAt ?? null,
        authorId: user.id,
        mentions: {
          createMany: { data: mentioned.map((userId) => ({ userId })) },
        },
      },
      select: { id: true, title: true, level: true },
    })

    await recordAudit({
      actor: user,
      action: 'ANNOUNCEMENT_CREATED',
      entityType: 'Announcement',
      entityId: created.id,
      entityLabel: created.title,
      classGroupId,
      summary: `${user.firstName} ${user.lastName} a publié une annonce (${created.title}).`,
      metadata: { level: created.level, mentions: mentioned.length },
    })

    const prefix =
      created.level === 'URGENT'
        ? 'URGENT — '
        : created.level === 'IMPORTANT'
          ? 'Important — '
          : ''

    await notifyClass(
      classGroupId,
      {
        type: 'ANNONCE',
        title: `${prefix}${created.title}`,
        body: truncate(data.content, 160),
        url: '/annonces',
        entityType: 'Announcement',
        entityId: created.id,
      },
      { excludeUserId: user.id },
    )

    // Notification dediee aux personnes citees : elle se distingue de
    // l'annonce generale dans la liste des notifications.
    if (mentioned.length > 0) {
      await notifyMembers(
        classGroupId,
        mentioned,
        {
          type: 'MENTION',
          title: `${user.firstName} ${user.lastName} vous a mentionne`,
          body: truncate(`${created.title} — ${data.content}`, 160),
          url: '/annonces',
          entityType: 'Announcement',
          entityId: created.id,
        },
        { excludeUserId: user.id },
      )
    }

    revalidatePath('/annonces')
    revalidatePath('/dashboard')
    return {
      ok: true,
      message:
        mentioned.length > 0
          ? `Annonce publiée. ${mentioned.length} membre(s) mentionné(s) notifié(s).`
          : 'Annonce publiée.',
    }
  })
}

export async function updateAnnouncementAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    const { user } = await requireClassAdmin()
    const announcementId = String(formData.get('announcementId') ?? '')
    const parsed = parseForm(announcementSchema, formData, ['mentionedUserIds'])
    if (!parsed.success) {
      return { ok: false, message: parsed.message, fieldErrors: parsed.fieldErrors }
    }
    const data = parsed.data

    const existing = await prisma.announcement.findFirst({
      where: { id: announcementId, deletedAt: null },
      select: { id: true, classGroupId: true },
    })
    if (!existing) throw new NotFoundError('Annonce introuvable.')
    assertCanManageClass(user, existing.classGroupId)
    await assertModuleInClass(data.moduleId, existing.classGroupId)

    const mentioned = await resolveMentions(
      existing.classGroupId,
      data.mentionedUserIds,
    )

    const updated = await prisma.$transaction(async (tx) => {
      await tx.announcementMention.deleteMany({ where: { announcementId } })
      return tx.announcement.update({
        where: { id: announcementId },
        data: {
          moduleId: data.moduleId ?? null,
          title: data.title,
          content: data.content,
          level: data.level,
          category: data.category,
          isPinned: data.isPinned,
          mentionsAll: data.mentionsAll,
          expiresAt: data.expiresAt ?? null,
          mentions: {
            createMany: { data: mentioned.map((userId) => ({ userId })) },
          },
        },
        select: { id: true, title: true, level: true },
      })
    })

    await recordAudit({
      actor: user,
      action: 'ANNOUNCEMENT_UPDATED',
      entityType: 'Announcement',
      entityId: updated.id,
      entityLabel: updated.title,
      classGroupId: existing.classGroupId,
      summary: `${user.firstName} ${user.lastName} a modifié l’annonce ${updated.title}.`,
    })

    // Une annonce qui devient urgente merite d'etre repoussee a la classe.
    if (updated.level === 'URGENT') {
      await notifyClass(
        existing.classGroupId,
        {
          type: 'ANNONCE',
          title: `URGENT — ${updated.title}`,
          body: truncate(data.content, 160),
          url: '/annonces',
          entityType: 'Announcement',
          entityId: updated.id,
        },
        { excludeUserId: user.id },
      )
    }

    revalidatePath('/annonces')
    revalidatePath('/dashboard')
    return {
      ok: true,
      message: `Annonce mise à jour (${ANNOUNCEMENT_LEVEL_LABELS[updated.level]}).`,
    }
  })
}

export async function deleteAnnouncementAction(formData: FormData): Promise<void> {
  const { user } = await requireClassAdmin()
  const announcementId = String(formData.get('announcementId') ?? '')

  const existing = await prisma.announcement.findFirst({
    where: { id: announcementId, deletedAt: null },
    select: { id: true, classGroupId: true, title: true },
  })
  if (!existing) throw new NotFoundError('Annonce introuvable.')
  assertCanManageClass(user, existing.classGroupId)

  await prisma.announcement.update({
    where: { id: announcementId },
    data: { deletedAt: new Date() },
  })

  await recordAudit({
    actor: user,
    action: 'ANNOUNCEMENT_DELETED',
    entityType: 'Announcement',
    entityId: existing.id,
    entityLabel: existing.title,
    classGroupId: existing.classGroupId,
    summary: `${user.firstName} ${user.lastName} a supprime l annonce ${existing.title}.`,
  })

  revalidatePath('/annonces')
  revalidatePath('/dashboard')
}
