'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/db'
import { requireClassAdmin } from '@/lib/auth/guards'
import {
  assertCanManageClass,
  assertModuleInClass,
  assertProjectInClass,
  requireManagedClassId,
} from '@/lib/permissions'
import { recordAudit } from '@/lib/audit'
import { notifyClass } from '@/lib/notifications'
import { runAction, NotFoundError, type ActionState } from '@/lib/errors'
import { deadlineSchema, parseForm } from '@/lib/validation'
import { DEADLINE_CATEGORY_LABELS } from '@/lib/constants'
import { formatDateTime } from '@/lib/utils'

export async function createDeadlineAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    const { user } = await requireClassAdmin()
    const parsed = parseForm(deadlineSchema, formData)
    if (!parsed.success) {
      return { ok: false, message: parsed.message, fieldErrors: parsed.fieldErrors }
    }
    const data = parsed.data
    const classGroupId = requireManagedClassId(user, data.classGroupId)
    await assertModuleInClass(data.moduleId, classGroupId)
    await assertProjectInClass(data.projectId, classGroupId)

    const deadline = await prisma.deadline.create({
      data: {
        classGroupId,
        moduleId: data.moduleId ?? null,
        projectId: data.projectId ?? null,
        title: data.title,
        description: data.description ?? null,
        category: data.category,
        dueAt: data.dueAt,
        reminderAt: data.reminderAt ?? null,
        createdById: user.id,
      },
      select: { id: true, title: true, category: true, dueAt: true },
    })

    await recordAudit({
      actor: user,
      action: 'DEADLINE_CREATED',
      entityType: 'Deadline',
      entityId: deadline.id,
      entityLabel: deadline.title,
      classGroupId,
      summary: `${user.firstName} ${user.lastName} a ajoute une echeance (${deadline.title}).`,
    })

    await notifyClass(
      classGroupId,
      {
        type: 'DEADLINE',
        title: 'Nouvelle echeance',
        body: `${DEADLINE_CATEGORY_LABELS[deadline.category]} : ${deadline.title} — ${formatDateTime(deadline.dueAt)}.`,
        url: '/echeances',
        entityType: 'Deadline',
        entityId: deadline.id,
      },
      { excludeUserId: user.id },
    )

    revalidatePath('/echeances')
    revalidatePath('/dashboard')
    return { ok: true, message: 'Echeance ajoutee.' }
  })
}

export async function updateDeadlineAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    const { user } = await requireClassAdmin()
    const deadlineId = String(formData.get('deadlineId') ?? '')
    const parsed = parseForm(deadlineSchema, formData)
    if (!parsed.success) {
      return { ok: false, message: parsed.message, fieldErrors: parsed.fieldErrors }
    }
    const data = parsed.data

    const existing = await prisma.deadline.findFirst({
      where: { id: deadlineId, deletedAt: null },
      select: { id: true, classGroupId: true, dueAt: true },
    })
    if (!existing) throw new NotFoundError('Echeance introuvable.')
    assertCanManageClass(user, existing.classGroupId)
    await assertModuleInClass(data.moduleId, existing.classGroupId)

    const updated = await prisma.deadline.update({
      where: { id: deadlineId },
      data: {
        moduleId: data.moduleId ?? null,
        title: data.title,
        description: data.description ?? null,
        category: data.category,
        dueAt: data.dueAt,
        reminderAt: data.reminderAt ?? null,
        // Une date modifiee doit pouvoir declencher un nouveau rappel.
        reminderSent: existing.dueAt.getTime() === data.dueAt.getTime() ? undefined : false,
      },
      select: { id: true, title: true, dueAt: true },
    })

    await recordAudit({
      actor: user,
      action: 'DEADLINE_UPDATED',
      entityType: 'Deadline',
      entityId: updated.id,
      entityLabel: updated.title,
      classGroupId: existing.classGroupId,
      summary: `${user.firstName} ${user.lastName} a modifie l echeance ${updated.title}.`,
    })

    if (existing.dueAt.getTime() !== data.dueAt.getTime()) {
      await notifyClass(
        existing.classGroupId,
        {
          type: 'DEADLINE',
          title: 'Echeance modifiee',
          body: `${updated.title} — nouvelle date : ${formatDateTime(updated.dueAt)}.`,
          url: '/echeances',
          entityType: 'Deadline',
          entityId: updated.id,
        },
        { excludeUserId: user.id },
      )
    }

    revalidatePath('/echeances')
    revalidatePath('/dashboard')
    return { ok: true, message: 'Echeance mise a jour.' }
  })
}

export async function deleteDeadlineAction(formData: FormData): Promise<void> {
  const { user } = await requireClassAdmin()
  const deadlineId = String(formData.get('deadlineId') ?? '')

  const existing = await prisma.deadline.findFirst({
    where: { id: deadlineId, deletedAt: null },
    select: { id: true, classGroupId: true, title: true },
  })
  if (!existing) throw new NotFoundError('Echeance introuvable.')
  assertCanManageClass(user, existing.classGroupId)

  await prisma.deadline.update({
    where: { id: deadlineId },
    data: { deletedAt: new Date() },
  })

  await recordAudit({
    actor: user,
    action: 'DEADLINE_DELETED',
    entityType: 'Deadline',
    entityId: existing.id,
    entityLabel: existing.title,
    classGroupId: existing.classGroupId,
    summary: `${user.firstName} ${user.lastName} a supprime l echeance ${existing.title}.`,
  })

  revalidatePath('/echeances')
  revalidatePath('/dashboard')
}

/**
 * Envoie les rappels dus.
 * Appelable par un Cron Vercel (voir vercel.json) ou depuis l'interface
 * d'administration. Idempotent grace au drapeau `reminderSent`.
 */
export async function dispatchDeadlineRemindersAction(): Promise<number> {
  const now = new Date()

  const due = await prisma.deadline.findMany({
    where: {
      deletedAt: null,
      reminderSent: false,
      reminderAt: { not: null, lte: now },
      dueAt: { gte: now },
    },
    select: {
      id: true,
      classGroupId: true,
      title: true,
      category: true,
      dueAt: true,
    },
    take: 100,
  })

  for (const deadline of due) {
    await notifyClass(deadline.classGroupId, {
      type: 'DEADLINE',
      title: 'Rappel d echeance',
      body: `${DEADLINE_CATEGORY_LABELS[deadline.category]} : ${deadline.title} — ${formatDateTime(deadline.dueAt)}.`,
      url: '/echeances',
      entityType: 'Deadline',
      entityId: deadline.id,
    })
    await prisma.deadline.update({
      where: { id: deadline.id },
      data: { reminderSent: true },
    })
  }

  return due.length
}
