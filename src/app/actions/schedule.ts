'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/db'
import { requireClassAdmin } from '@/lib/auth/guards'
import {
  assertCanManageClass,
  assertModuleInClass,
  assertSemesterInClass,
  requireManagedClassId,
} from '@/lib/permissions'
import { recordAudit } from '@/lib/audit'
import { notifyClass } from '@/lib/notifications'
import { runAction, NotFoundError, type ActionState } from '@/lib/errors'
import { parseForm, scheduleDocumentSchema, scheduleSchema } from '@/lib/validation'
import {
  assertClassQuota,
  assertValidScheduleDocument,
  classPrefix,
  removeFile,
  storeFile,
  trackClassStorage,
} from '@/lib/storage'
import { formatDateShort, minutesToTime, timeToMinutes, toDateOnly } from '@/lib/utils'

/**
 * Gestion du programme. Reserve au delegue de la classe :
 * `requireClassAdmin` bloque un etudiant meme s'il forge la requete
 * lui-meme, et toute seance visee est recoupee avec sa classe.
 */

export async function createScheduleEntryAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    const { user } = await requireClassAdmin()
    const parsed = parseForm(scheduleSchema, formData)
    if (!parsed.success) {
      return { ok: false, message: parsed.message, fieldErrors: parsed.fieldErrors }
    }
    const data = parsed.data
    const classGroupId = requireManagedClassId(user, data.classGroupId)

    await assertSemesterInClass(data.semesterId, classGroupId)
    await assertModuleInClass(data.moduleId, classGroupId)

    const startMinutes = timeToMinutes(data.startTime)
    const endMinutes = timeToMinutes(data.endTime)

    const entry = await prisma.scheduleEntry.create({
      data: {
        classGroupId,
        semesterId: data.semesterId,
        moduleId: data.moduleId ?? null,
        type: data.type,
        title: data.title ?? null,
        date: toDateOnly(data.date),
        startMinutes,
        endMinutes,
        room: data.room ?? null,
        teacherName: data.teacherName ?? null,
        note: data.note ?? null,
        isPublished: data.isPublished,
        createdById: user.id,
      },
      select: {
        id: true,
        title: true,
        date: true,
        isPublished: true,
        module: { select: { name: true } },
      },
    })

    const label = entry.module?.name ?? entry.title ?? 'Séance'

    await recordAudit({
      actor: user,
      action: 'SCHEDULE_CREATED',
      entityType: 'ScheduleEntry',
      entityId: entry.id,
      entityLabel: label,
      classGroupId,
      summary: `${user.firstName} ${user.lastName} a ajouté une séance (${label}) le ${formatDateShort(entry.date)}.`,
    })

    if (entry.isPublished) {
      await notifyClass(
        classGroupId,
        {
          type: 'PROGRAMME',
          title: 'Programme mis à jour',
          body: `${label} le ${formatDateShort(entry.date)} a ${minutesToTime(startMinutes)}.`,
          url: '/programme',
          entityType: 'ScheduleEntry',
          entityId: entry.id,
        },
        { excludeUserId: user.id },
      )
    }

    revalidatePath('/programme')
    revalidatePath('/dashboard')
    return { ok: true, message: 'Séance ajoutée.' }
  })
}

export async function updateScheduleEntryAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    const { user } = await requireClassAdmin()
    const entryId = String(formData.get('entryId') ?? '')
    if (!entryId) throw new NotFoundError('Séance introuvable.')

    const parsed = parseForm(scheduleSchema, formData)
    if (!parsed.success) {
      return { ok: false, message: parsed.message, fieldErrors: parsed.fieldErrors }
    }
    const data = parsed.data

    const existing = await prisma.scheduleEntry.findFirst({
      where: { id: entryId, deletedAt: null },
      select: { id: true, classGroupId: true },
    })
    // Verifier aussi la classe empeche de modifier la seance d'une autre
    // classe en changeant l'identifiant dans le formulaire.
    if (!existing) throw new NotFoundError('Séance introuvable.')
    assertCanManageClass(user, existing.classGroupId)

    await assertSemesterInClass(data.semesterId, existing.classGroupId)
    await assertModuleInClass(data.moduleId, existing.classGroupId)

    const updated = await prisma.scheduleEntry.update({
      where: { id: entryId },
      data: {
        semesterId: data.semesterId,
        moduleId: data.moduleId ?? null,
        type: data.type,
        title: data.title ?? null,
        date: toDateOnly(data.date),
        startMinutes: timeToMinutes(data.startTime),
        endMinutes: timeToMinutes(data.endTime),
        room: data.room ?? null,
        teacherName: data.teacherName ?? null,
        note: data.note ?? null,
        isPublished: data.isPublished,
      },
      select: {
        id: true,
        title: true,
        date: true,
        module: { select: { name: true } },
      },
    })

    const label = updated.module?.name ?? updated.title ?? 'Séance'

    await recordAudit({
      actor: user,
      action: 'SCHEDULE_UPDATED',
      entityType: 'ScheduleEntry',
      entityId: updated.id,
      entityLabel: label,
      classGroupId: existing.classGroupId,
      summary: `${user.firstName} ${user.lastName} a modifié le programme (${label}).`,
    })

    await notifyClass(
      existing.classGroupId,
      {
        type: 'PROGRAMME',
        title: 'Changement dans le programme',
        body: `${label} — ${formatDateShort(updated.date)}.`,
        url: '/programme',
        entityType: 'ScheduleEntry',
        entityId: updated.id,
      },
      { excludeUserId: user.id },
    )

    revalidatePath('/programme')
    revalidatePath('/dashboard')
    return { ok: true, message: 'Séance mise à jour.' }
  })
}

export async function deleteScheduleEntryAction(formData: FormData): Promise<void> {
  const { user } = await requireClassAdmin()
  const entryId = String(formData.get('entryId') ?? '')

  const existing = await prisma.scheduleEntry.findFirst({
    where: { id: entryId, deletedAt: null },
    select: {
      id: true,
      classGroupId: true,
      title: true,
      date: true,
      module: { select: { name: true } },
    },
  })
  if (!existing) throw new NotFoundError('Séance introuvable.')
  assertCanManageClass(user, existing.classGroupId)

  // Suppression douce : la seance disparait de l'affichage mais reste
  // tracable pour l'audit.
  await prisma.scheduleEntry.update({
    where: { id: entryId },
    data: { deletedAt: new Date() },
  })

  const label = existing.module?.name ?? existing.title ?? 'Séance'
  await recordAudit({
    actor: user,
    action: 'SCHEDULE_DELETED',
    entityType: 'ScheduleEntry',
    entityId: existing.id,
    entityLabel: label,
    classGroupId: existing.classGroupId,
    summary: `${user.firstName} ${user.lastName} a supprimé une séance (${label}) du ${formatDateShort(existing.date)}.`,
  })

  await notifyClass(
    existing.classGroupId,
    {
      type: 'PROGRAMME',
      title: 'Séance annulée',
      body: `${label} du ${formatDateShort(existing.date)} a ete retiree du programme.`,
      url: '/programme',
    },
    { excludeUserId: user.id },
  )

  revalidatePath('/programme')
  revalidatePath('/dashboard')
}

// ---------------------------------------------------------------------------
// Emploi du temps televerse (image ou PDF)
// ---------------------------------------------------------------------------

/**
 * Depose le planning officiel recu par le delegue (photo ou PDF).
 * Le document coexiste avec la saisie manuelle : la classe peut consulter
 * l'image ET continuer a recevoir les seances detaillees.
 */
export async function uploadScheduleDocumentAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    const { user, classId } = await requireClassAdmin()
    const parsed = parseForm(scheduleDocumentSchema, formData)
    if (!parsed.success) {
      return { ok: false, message: parsed.message, fieldErrors: parsed.fieldErrors }
    }
    const data = parsed.data

    const file = formData.get('file')
    if (!(file instanceof File) || file.size === 0) {
      return { ok: false, message: 'Sélectionnez une image ou un PDF.' }
    }
    assertValidScheduleDocument(file)
    await assertClassQuota(classId, file.size)

    if (data.semesterId) await assertSemesterInClass(data.semesterId, classId)

    const stored = await storeFile(file, classPrefix(classId, 'schedule'))

    let document
    try {
      document = await prisma.$transaction(async (tx) => {
        // Un seul document courant : le precedent reste consultable dans
        // l'historique mais n'est plus mis en avant.
        await tx.scheduleDocument.updateMany({
          where: { classGroupId: classId, isCurrent: true },
          data: { isCurrent: false },
        })
        return tx.scheduleDocument.create({
          data: {
            classGroupId: classId,
            semesterId: data.semesterId ?? null,
            title: data.title,
            note: data.note ?? null,
            fileName: stored.fileName,
            filePath: stored.filePath,
            fileSize: stored.fileSize,
            mimeType: stored.mimeType,
            isCurrent: true,
            uploadedById: user.id,
          },
          select: { id: true, title: true },
        })
      })
    } catch (error) {
      await removeFile(stored.filePath)
      throw error
    }

    await trackClassStorage(classId, stored.fileSize)

    await recordAudit({
      actor: user,
      action: 'SCHEDULE_DOCUMENT_UPLOADED',
      entityType: 'ScheduleDocument',
      entityId: document.id,
      entityLabel: document.title,
      classGroupId: classId,
      summary: `${user.firstName} ${user.lastName} a televerse un emploi du temps (${document.title}).`,
    })

    await notifyClass(
      classId,
      {
        type: 'PROGRAMME',
        title: 'Emploi du temps mis a jour',
        body: document.title,
        url: '/programme',
        entityType: 'ScheduleDocument',
        entityId: document.id,
      },
      { excludeUserId: user.id },
    )

    revalidatePath('/programme')
    return { ok: true, message: 'Emploi du temps televerse.' }
  })
}

export async function deleteScheduleDocumentAction(formData: FormData): Promise<void> {
  const { user, classId } = await requireClassAdmin()
  const documentId = String(formData.get('documentId') ?? '')

  // Le filtre sur classGroupId rend impossible la suppression du document
  // d'une autre classe.
  const document = await prisma.scheduleDocument.findFirst({
    where: { id: documentId, classGroupId: classId, deletedAt: null },
    select: { id: true, title: true, filePath: true, fileSize: true, isCurrent: true },
  })
  if (!document) throw new NotFoundError('Document introuvable.')

  await prisma.scheduleDocument.update({
    where: { id: document.id },
    data: { deletedAt: new Date(), isCurrent: false },
  })
  await removeFile(document.filePath)
  await trackClassStorage(classId, -document.fileSize)

  // Le plus recent restant reprend la place de document courant.
  if (document.isCurrent) {
    const previous = await prisma.scheduleDocument.findFirst({
      where: { classGroupId: classId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    })
    if (previous) {
      await prisma.scheduleDocument.update({
        where: { id: previous.id },
        data: { isCurrent: true },
      })
    }
  }

  await recordAudit({
    actor: user,
    action: 'SCHEDULE_DOCUMENT_DELETED',
    entityType: 'ScheduleDocument',
    entityId: document.id,
    entityLabel: document.title,
    classGroupId: classId,
    summary: `${user.firstName} ${user.lastName} a supprime un emploi du temps televerse.`,
  })

  revalidatePath('/programme')
}

/** Remet un document de l'historique en avant. */
export async function setCurrentScheduleDocumentAction(
  formData: FormData,
): Promise<void> {
  const { classId } = await requireClassAdmin()
  const documentId = String(formData.get('documentId') ?? '')

  const document = await prisma.scheduleDocument.findFirst({
    where: { id: documentId, classGroupId: classId, deletedAt: null },
    select: { id: true },
  })
  if (!document) throw new NotFoundError('Document introuvable.')

  await prisma.$transaction([
    prisma.scheduleDocument.updateMany({
      where: { classGroupId: classId, isCurrent: true },
      data: { isCurrent: false },
    }),
    prisma.scheduleDocument.update({
      where: { id: document.id },
      data: { isCurrent: true },
    }),
  ])

  revalidatePath('/programme')
}
