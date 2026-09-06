'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/db'
import { requireClassAdmin } from '@/lib/auth/guards'
import {
  assertModuleInClass,
  assertProjectInClass,
  assertSemesterInClass,
  assertCanManageClass,
  requireManagedClassId,
} from '@/lib/permissions'
import { recordAudit } from '@/lib/audit'
import { notifyClass } from '@/lib/notifications'
import {
  assertClassQuota,
  assertValidUpload,
  classPrefix,
  removeFile,
  storeFile,
  trackClassStorage,
} from '@/lib/storage'
import { runAction, NotFoundError, type ActionState } from '@/lib/errors'
import { parseForm, resourceCreateSchema, resourceUpdateSchema } from '@/lib/validation'
import { RESOURCE_KIND_LABELS } from '@/lib/constants'

export async function createResourceAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    const { user } = await requireClassAdmin()
    const parsed = parseForm(resourceCreateSchema, formData)
    if (!parsed.success) {
      return { ok: false, message: parsed.message, fieldErrors: parsed.fieldErrors }
    }
    const data = parsed.data
    const classGroupId = requireManagedClassId(user, data.classGroupId)

    const file = formData.get('file')
    if (!(file instanceof File) || file.size === 0) {
      return { ok: false, message: 'Selectionnez un fichier a deposer.' }
    }
    // Taille, type MIME et extension sont verifies cote serveur : le
    // filtre du champ <input accept> n'est qu'un confort visuel.
    assertValidUpload(file)
    await assertClassQuota(classGroupId, file.size)

    // Semestre, module et projet doivent appartenir a CETTE classe : sans
    // ces controles, un delegue pourrait rattacher un fichier au
    // calendrier ou au projet d'une autre classe.
    await assertSemesterInClass(data.semesterId, classGroupId)
    await assertModuleInClass(data.moduleId, classGroupId)
    await assertProjectInClass(data.projectId, classGroupId)

    const stored = await storeFile(file, classPrefix(classGroupId, 'resources'))

    let resource
    try {
      resource = await prisma.resource.create({
        data: {
          classGroupId,
          semesterId: data.semesterId,
          moduleId: data.moduleId ?? null,
          projectId: data.projectId ?? null,
          title: data.title,
          description: data.description ?? null,
          kind: data.kind,
          fileName: stored.fileName,
          filePath: stored.filePath,
          fileSize: stored.fileSize,
          mimeType: stored.mimeType,
          uploadedById: user.id,
        },
        select: {
          id: true,
          title: true,
          kind: true,
          module: { select: { code: true, name: true } },
        },
      })
    } catch (error) {
      // Le fichier est deja dans le stockage : sans ce nettoyage il
      // resterait orphelin, sans ligne correspondante en base.
      await removeFile(stored.filePath)
      throw error
    }

    await trackClassStorage(classGroupId, stored.fileSize)

    await recordAudit({
      actor: user,
      action: 'RESOURCE_CREATED',
      entityType: 'Resource',
      entityId: resource.id,
      entityLabel: resource.title,
      classGroupId,
      summary: `${user.firstName} ${user.lastName} a ajoute une ressource (${resource.title}).`,
      metadata: { kind: resource.kind, fileSize: stored.fileSize },
    })

    await notifyClass(
      classGroupId,
      {
        type: 'RESSOURCE',
        title: 'Nouvelle ressource',
        body: `${RESOURCE_KIND_LABELS[resource.kind] ?? resource.kind} : ${resource.title}${
          resource.module ? ` (${resource.module.code})` : ''
        }`,
        url: '/ressources',
        entityType: 'Resource',
        entityId: resource.id,
      },
      { excludeUserId: user.id },
    )

    revalidatePath('/ressources')
    revalidatePath('/dashboard')
    if (resource.module) revalidatePath('/modules')
    return { ok: true, message: 'Ressource ajoutee.' }
  })
}

export async function updateResourceAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    const { user } = await requireClassAdmin()
    const parsed = parseForm(resourceUpdateSchema, formData)
    if (!parsed.success) {
      return { ok: false, message: parsed.message, fieldErrors: parsed.fieldErrors }
    }
    const data = parsed.data

    const existing = await prisma.resource.findFirst({
      where: { id: data.id, deletedAt: null },
      select: { id: true, classGroupId: true },
    })
    if (!existing) throw new NotFoundError('Ressource introuvable.')
    assertCanManageClass(user, existing.classGroupId)

    await assertModuleInClass(data.moduleId, existing.classGroupId)

    const updated = await prisma.resource.update({
      where: { id: data.id },
      data: {
        title: data.title,
        description: data.description ?? null,
        kind: data.kind,
        moduleId: data.moduleId ?? null,
      },
      select: { id: true, title: true },
    })

    await recordAudit({
      actor: user,
      action: 'RESOURCE_UPDATED',
      entityType: 'Resource',
      entityId: updated.id,
      entityLabel: updated.title,
      classGroupId: existing.classGroupId,
      summary: `${user.firstName} ${user.lastName} a modifie la ressource ${updated.title}.`,
    })

    revalidatePath('/ressources')
    revalidatePath('/modules')
    return { ok: true, message: 'Ressource mise a jour.' }
  })
}

export async function deleteResourceAction(formData: FormData): Promise<void> {
  const { user } = await requireClassAdmin()
  const resourceId = String(formData.get('resourceId') ?? '')

  const existing = await prisma.resource.findFirst({
    where: { id: resourceId, deletedAt: null },
    select: { id: true, classGroupId: true, title: true, filePath: true, fileSize: true },
  })
  if (!existing) throw new NotFoundError('Ressource introuvable.')
  assertCanManageClass(user, existing.classGroupId)

  await prisma.resource.update({
    where: { id: resourceId },
    data: { deletedAt: new Date() },
  })

  // Le binaire est retire du stockage : conserver une ligne en soft delete
  // ne justifie pas de payer le stockage du fichier indefiniment.
  await removeFile(existing.filePath)
  await trackClassStorage(existing.classGroupId, -existing.fileSize)

  await recordAudit({
    actor: user,
    action: 'RESOURCE_DELETED',
    entityType: 'Resource',
    entityId: existing.id,
    entityLabel: existing.title,
    classGroupId: existing.classGroupId,
    summary: `${user.firstName} ${user.lastName} a supprime la ressource ${existing.title}.`,
  })

  revalidatePath('/ressources')
  revalidatePath('/modules')
  revalidatePath('/dashboard')
}

export async function toggleResourceArchiveAction(formData: FormData): Promise<void> {
  const { user } = await requireClassAdmin()
  const resourceId = String(formData.get('resourceId') ?? '')

  const existing = await prisma.resource.findFirst({
    where: { id: resourceId, deletedAt: null },
    select: { id: true, classGroupId: true, title: true, isArchived: true },
  })
  if (!existing) throw new NotFoundError('Ressource introuvable.')
  assertCanManageClass(user, existing.classGroupId)

  await prisma.resource.update({
    where: { id: resourceId },
    data: { isArchived: !existing.isArchived },
  })

  await recordAudit({
    actor: user,
    action: existing.isArchived ? 'RESOURCE_UNARCHIVED' : 'RESOURCE_ARCHIVED',
    entityType: 'Resource',
    entityId: existing.id,
    entityLabel: existing.title,
    classGroupId: existing.classGroupId,
    summary: `${user.firstName} ${user.lastName} a ${
      existing.isArchived ? 'desarchive' : 'archive'
    } la ressource ${existing.title}.`,
  })

  revalidatePath('/ressources')
}
