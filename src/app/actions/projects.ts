'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/db'
import { requireClassAdmin } from '@/lib/auth/guards'
import {
  assertModuleInClass,
  assertCanManageClass,
  assertSemesterInClass,
  requireManagedClassId,
} from '@/lib/permissions'
import { recordAudit } from '@/lib/audit'
import { notifyClass } from '@/lib/notifications'
import { runAction, NotFoundError, type ActionState } from '@/lib/errors'
import { parseForm, projectLinkSchema, projectSchema } from '@/lib/validation'
import { formatDateShort } from '@/lib/utils'

export async function createProjectAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    const { user } = await requireClassAdmin()
    const parsed = parseForm(projectSchema, formData)
    if (!parsed.success) {
      return { ok: false, message: parsed.message, fieldErrors: parsed.fieldErrors }
    }
    const data = parsed.data
    const classGroupId = requireManagedClassId(user, data.classGroupId)

    await assertSemesterInClass(data.semesterId, classGroupId)
    await assertModuleInClass(data.moduleId, classGroupId)

    const project = await prisma.project.create({
      data: {
        classGroupId,
        semesterId: data.semesterId,
        moduleId: data.moduleId ?? null,
        title: data.title,
        description: data.description ?? null,
        instructions: data.instructions ?? null,
        teacherName: data.teacherName ?? null,
        startsAt: data.startsAt ?? null,
        dueAt: data.dueAt,
        createdById: user.id,
        // Un projet crée systématiquement son échéance : les étudiants
        // retrouvent ainsi tous leurs rendus au meme endroit.
        deadlines: {
          create: {
            classGroupId,
            moduleId: data.moduleId ?? null,
            title: `Rendu : ${data.title}`,
            category: 'PROJET',
            dueAt: data.dueAt,
            createdById: user.id,
          },
        },
      },
      select: { id: true, title: true, dueAt: true },
    })

    await recordAudit({
      actor: user,
      action: 'PROJECT_CREATED',
      entityType: 'Project',
      entityId: project.id,
      entityLabel: project.title,
      classGroupId,
      summary: `${user.firstName} ${user.lastName} a créé le projet ${project.title}.`,
    })

    await notifyClass(
      classGroupId,
      {
        type: 'PROJET',
        title: 'Nouveau projet',
        body: `${project.title} — à rendre avant le ${formatDateShort(project.dueAt)}.`,
        url: `/projets/${project.id}`,
        entityType: 'Project',
        entityId: project.id,
      },
      { excludeUserId: user.id },
    )

    revalidatePath('/projets')
    revalidatePath('/echeances')
    revalidatePath('/dashboard')
    return { ok: true, message: 'Projet créé.' }
  })
}

export async function updateProjectAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    const { user } = await requireClassAdmin()
    const projectId = String(formData.get('projectId') ?? '')
    const parsed = parseForm(projectSchema, formData)
    if (!parsed.success) {
      return { ok: false, message: parsed.message, fieldErrors: parsed.fieldErrors }
    }
    const data = parsed.data

    const existing = await prisma.project.findFirst({
      where: { id: projectId, deletedAt: null },
      select: { id: true, classGroupId: true, dueAt: true },
    })
    if (!existing) throw new NotFoundError('Projet introuvable.')
    assertCanManageClass(user, existing.classGroupId)

    await assertSemesterInClass(data.semesterId, existing.classGroupId)
    await assertModuleInClass(data.moduleId, existing.classGroupId)

    const updated = await prisma.project.update({
      where: { id: projectId },
      data: {
        semesterId: data.semesterId,
        moduleId: data.moduleId ?? null,
        title: data.title,
        description: data.description ?? null,
        instructions: data.instructions ?? null,
        teacherName: data.teacherName ?? null,
        startsAt: data.startsAt ?? null,
        dueAt: data.dueAt,
      },
      select: { id: true, title: true, dueAt: true },
    })

    // L'echeance liee suit la date du projet, sinon les deux affichages
    // se contrediraient.
    if (existing.dueAt.getTime() !== data.dueAt.getTime()) {
      await prisma.deadline.updateMany({
        where: { projectId, deletedAt: null, category: 'PROJET' },
        data: { dueAt: data.dueAt },
      })

      await notifyClass(
        existing.classGroupId,
        {
          type: 'PROJET',
          title: 'Date de rendu modifiée',
          body: `${updated.title} — nouvelle date : ${formatDateShort(updated.dueAt)}.`,
          url: `/projets/${updated.id}`,
          entityType: 'Project',
          entityId: updated.id,
        },
        { excludeUserId: user.id },
      )
    }

    await recordAudit({
      actor: user,
      action: 'PROJECT_UPDATED',
      entityType: 'Project',
      entityId: updated.id,
      entityLabel: updated.title,
      classGroupId: existing.classGroupId,
      summary: `${user.firstName} ${user.lastName} a modifié le projet ${updated.title}.`,
    })

    revalidatePath('/projets')
    revalidatePath(`/projets/${projectId}`)
    revalidatePath('/echeances')
    return { ok: true, message: 'Projet mis à jour.' }
  })
}

export async function deleteProjectAction(formData: FormData): Promise<void> {
  const { user } = await requireClassAdmin()
  const projectId = String(formData.get('projectId') ?? '')

  const existing = await prisma.project.findFirst({
    where: { id: projectId, deletedAt: null },
    select: { id: true, classGroupId: true, title: true },
  })
  if (!existing) throw new NotFoundError('Projet introuvable.')
  assertCanManageClass(user, existing.classGroupId)

  await prisma.$transaction([
    prisma.project.update({ where: { id: projectId }, data: { deletedAt: new Date() } }),
    prisma.deadline.updateMany({
      where: { projectId, deletedAt: null },
      data: { deletedAt: new Date() },
    }),
  ])

  await recordAudit({
    actor: user,
    action: 'PROJECT_DELETED',
    entityType: 'Project',
    entityId: existing.id,
    entityLabel: existing.title,
    classGroupId: existing.classGroupId,
    summary: `${user.firstName} ${user.lastName} a supprime le projet ${existing.title}.`,
  })

  revalidatePath('/projets')
  revalidatePath('/echeances')
  revalidatePath('/dashboard')
}

export async function addProjectLinkAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    const { user } = await requireClassAdmin()
    const parsed = parseForm(projectLinkSchema, formData)
    if (!parsed.success) {
      return { ok: false, message: parsed.message, fieldErrors: parsed.fieldErrors }
    }

    const project = await prisma.project.findFirst({
      where: { id: parsed.data.projectId, deletedAt: null },
      select: { id: true, classGroupId: true },
    })
    if (!project) throw new NotFoundError('Projet introuvable.')
    assertCanManageClass(user, project.classGroupId)

    await prisma.projectLink.create({
      data: {
        projectId: project.id,
        label: parsed.data.label,
        url: parsed.data.url,
      },
    })

    revalidatePath(`/projets/${project.id}`)
    return { ok: true, message: 'Lien ajoute.' }
  })
}

export async function deleteProjectLinkAction(formData: FormData): Promise<void> {
  const { user } = await requireClassAdmin()
  const linkId = String(formData.get('linkId') ?? '')

  const link = await prisma.projectLink.findUnique({
    where: { id: linkId },
    select: { id: true, projectId: true, project: { select: { classGroupId: true } } },
  })
  if (!link) throw new NotFoundError('Lien introuvable.')
  assertCanManageClass(user, link.project.classGroupId)

  await prisma.projectLink.delete({ where: { id: linkId } })
  revalidatePath(`/projets/${link.projectId}`)
}
