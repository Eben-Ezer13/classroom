'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/db'
import { requireClassAdmin } from '@/lib/auth/guards'
import {
  assertCanManageClass,
  assertSemesterInClass,
  requireManagedClassId,
} from '@/lib/permissions'
import { recordAudit } from '@/lib/audit'
import { runAction, AppError, NotFoundError, type ActionState } from '@/lib/errors'
import { moduleSchema, parseForm } from '@/lib/validation'

export async function createModuleAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    const { user } = await requireClassAdmin()
    const parsed = parseForm(moduleSchema, formData)
    if (!parsed.success) {
      return { ok: false, message: parsed.message, fieldErrors: parsed.fieldErrors }
    }
    const data = parsed.data
    const classGroupId = requireManagedClassId(user, data.classGroupId)
    await assertSemesterInClass(data.semesterId, classGroupId)

    const duplicate = await prisma.module.findFirst({
      where: { classGroupId, semesterId: data.semesterId, code: data.code },
      select: { id: true, deletedAt: true },
    })
    if (duplicate) {
      return {
        ok: false,
        message: `Le code ${data.code} existe deja pour ce semestre.`,
        fieldErrors: { code: ['Code deja utilise sur ce semestre.'] },
      }
    }

    const created = await prisma.module.create({
      data: {
        classGroupId,
        semesterId: data.semesterId,
        code: data.code,
        name: data.name,
        description: data.description ?? null,
        teacherName: data.teacherName ?? null,
        teacherEmail: data.teacherEmail ?? null,
        credits: data.credits ?? null,
        color: data.color ?? null,
      },
      select: { id: true, code: true, name: true },
    })

    await recordAudit({
      actor: user,
      action: 'MODULE_CREATED',
      entityType: 'Module',
      entityId: created.id,
      entityLabel: `${created.code} — ${created.name}`,
      classGroupId,
      summary: `${user.firstName} ${user.lastName} a créé le module ${created.code} (${created.name}).`,
    })

    revalidatePath('/modules')
    return { ok: true, message: 'Module créé.' }
  })
}

export async function updateModuleAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    const { user } = await requireClassAdmin()
    const moduleId = String(formData.get('moduleId') ?? '')
    const parsed = parseForm(moduleSchema, formData)
    if (!parsed.success) {
      return { ok: false, message: parsed.message, fieldErrors: parsed.fieldErrors }
    }
    const data = parsed.data

    const existing = await prisma.module.findFirst({
      where: { id: moduleId, deletedAt: null },
      select: { id: true, classGroupId: true },
    })
    if (!existing) throw new NotFoundError('Module introuvable.')
    assertCanManageClass(user, existing.classGroupId)
    await assertSemesterInClass(data.semesterId, existing.classGroupId)

    const duplicate = await prisma.module.findFirst({
      where: {
        classGroupId: existing.classGroupId,
        semesterId: data.semesterId,
        code: data.code,
        id: { not: moduleId },
      },
      select: { id: true },
    })
    if (duplicate) {
      return {
        ok: false,
        message: `Le code ${data.code} existe deja pour ce semestre.`,
        fieldErrors: { code: ['Code deja utilise sur ce semestre.'] },
      }
    }

    const updated = await prisma.module.update({
      where: { id: moduleId },
      data: {
        semesterId: data.semesterId,
        code: data.code,
        name: data.name,
        description: data.description ?? null,
        teacherName: data.teacherName ?? null,
        teacherEmail: data.teacherEmail ?? null,
        credits: data.credits ?? null,
        color: data.color ?? null,
      },
      select: { id: true, code: true, name: true },
    })

    await recordAudit({
      actor: user,
      action: 'MODULE_UPDATED',
      entityType: 'Module',
      entityId: updated.id,
      entityLabel: `${updated.code} — ${updated.name}`,
      classGroupId: existing.classGroupId,
      summary: `${user.firstName} ${user.lastName} a modifié le module ${updated.code}.`,
    })

    revalidatePath('/modules')
    revalidatePath(`/modules/${moduleId}`)
    return { ok: true, message: 'Module mis à jour.' }
  })
}

export async function deleteModuleAction(formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const { user } = await requireClassAdmin()
    const moduleId = String(formData.get('moduleId') ?? '')

    const existing = await prisma.module.findFirst({
      where: { id: moduleId, deletedAt: null },
      select: {
        id: true,
        classGroupId: true,
        code: true,
        name: true,
        // Seul le contenu encore visible compte : une ressource supprimee
        // ne doit pas bloquer la suppression du module.
        _count: {
          select: {
            resources: { where: { deletedAt: null } },
            schedule: { where: { deletedAt: null } },
            projects: { where: { deletedAt: null } },
          },
        },
      },
    })
    if (!existing) throw new NotFoundError('Module introuvable.')
    assertCanManageClass(user, existing.classGroupId)

    const attached =
      existing._count.resources + existing._count.schedule + existing._count.projects
    if (attached > 0) {
      // Refus explicite plutot qu'une cascade silencieuse : supprimer un
      // module ne doit pas faire disparaitre des ressources par surprise.
      throw new AppError(
        `Ce module est encore utilisé (${existing._count.resources} ressource(s), ` +
          `${existing._count.schedule} séance(s), ${existing._count.projects} projet(s)). ` +
          `Détachez-les avant de le supprimer.`,
      )
    }

    await prisma.module.update({
      where: { id: moduleId },
      data: { deletedAt: new Date(), isActive: false },
    })

    await recordAudit({
      actor: user,
      action: 'MODULE_DELETED',
      entityType: 'Module',
      entityId: existing.id,
      entityLabel: `${existing.code} — ${existing.name}`,
      classGroupId: existing.classGroupId,
      summary: `${user.firstName} ${user.lastName} a supprimé le module ${existing.code}.`,
    })

    revalidatePath('/modules')
    return { ok: true, message: `Module ${existing.code} supprimé.` }
  })
}
