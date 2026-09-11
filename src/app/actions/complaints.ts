'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/db'
import { requireClassAdmin, requireUser } from '@/lib/auth/guards'
import { assertCanManageClass, requireClassId } from '@/lib/permissions'
import { recordAudit } from '@/lib/audit'
import { notifyClassStaff, notifyUser } from '@/lib/notifications'
import {
  assertClassQuota,
  discardStoredFiles,
  receiveUploads,
  trackClassStorage,
} from '@/lib/storage'
import { runAction, ForbiddenError, NotFoundError, type ActionState } from '@/lib/errors'
import {
  complaintMessageSchema,
  complaintSchema,
  complaintStatusSchema,
  parseForm,
} from '@/lib/validation'
import { COMPLAINT_STATUS_LABELS } from '@/lib/constants'
import { truncate } from '@/lib/utils'
import { loadComplaintFor } from '@/lib/services/complaints'

export async function createComplaintAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    const user = await requireUser()
    const parsed = parseForm(complaintSchema, formData)
    if (!parsed.success) {
      return { ok: false, message: parsed.message, fieldErrors: parsed.fieldErrors }
    }
    const data = parsed.data
    const classGroupId = requireClassId(user, null)

    // Pieces jointes facultatives, validees AVANT la creation : une piece
    // refusee ne laisse pas derriere elle une reclamation incomplete.
    const attachments = await receiveUploads(formData, {
      field: 'attachments',
      kind: 'complaint',
      classGroupId,
      userId: user.id,
    })
    const totalSize = attachments.reduce((sum, file) => sum + file.fileSize, 0)

    let complaint
    try {
      if (totalSize > 0) await assertClassQuota(classGroupId, totalSize)
      complaint = await prisma.complaint.create({
        data: {
          classGroupId,
          authorId: user.id,
          title: data.title,
          category: data.category,
          description: data.description,
          priority: data.priority,
          attachments: {
            create: attachments.map((file) => ({
              fileName: file.fileName,
              filePath: file.filePath,
              fileSize: file.fileSize,
              mimeType: file.mimeType,
              uploadedById: user.id,
            })),
          },
        },
        select: { id: true, title: true, priority: true },
      })
    } catch (error) {
      await discardStoredFiles(attachments)
      throw error
    }

    // Les pieces jointes comptent dans le quota de la classe.
    await trackClassStorage(classGroupId, totalSize)

    await recordAudit({
      actor: user,
      action: 'COMPLAINT_CREATED',
      entityType: 'Complaint',
      entityId: complaint.id,
      entityLabel: complaint.title,
      classGroupId,
      summary: `${user.firstName} ${user.lastName} a signalé une difficulté (${complaint.title}).`,
      metadata: { priority: complaint.priority },
    })

    await notifyClassStaff(
      classGroupId,
      {
        type: 'RECLAMATION',
        title: 'Nouvelle réclamation',
        body: `${complaint.title} — ${user.firstName} ${user.lastName}`,
        url: `/reclamations/${complaint.id}`,
        entityType: 'Complaint',
        entityId: complaint.id,
      },
      { excludeUserId: user.id },
    )

    revalidatePath('/reclamations')
    return { ok: true, message: 'Réclamation envoyée.' }
  })
}

export async function addComplaintMessageAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    const user = await requireUser()
    const parsed = parseForm(complaintMessageSchema, formData)
    if (!parsed.success) {
      return { ok: false, message: parsed.message, fieldErrors: parsed.fieldErrors }
    }

    const { complaint, isStaff } = await loadComplaintFor(user, parsed.data.complaintId)

    if (complaint.status === 'FERME') {
      throw new ForbiddenError('Cette réclamation est fermée.')
    }

    await prisma.complaintMessage.create({
      data: {
        complaintId: complaint.id,
        authorId: user.id,
        body: parsed.data.body,
      },
    })

    // On previent l'autre partie : l'auteur si un responsable repond,
    // les responsables si l'auteur relance.
    if (isStaff && complaint.authorId !== user.id) {
      await notifyUser(
        complaint.authorId,
        {
          type: 'RECLAMATION',
          title: 'Réponse à votre réclamation',
          body: truncate(parsed.data.body, 160),
          url: `/reclamations/${complaint.id}`,
          entityType: 'Complaint',
          entityId: complaint.id,
        },
        complaint.classGroupId,
      )
    } else {
      await notifyClassStaff(
        complaint.classGroupId,
        {
          type: 'RECLAMATION',
          title: 'Nouveau message sur une réclamation',
          body: `${complaint.title} — ${truncate(parsed.data.body, 120)}`,
          url: `/reclamations/${complaint.id}`,
          entityType: 'Complaint',
          entityId: complaint.id,
        },
        { excludeUserId: user.id },
      )
    }

    revalidatePath(`/reclamations/${complaint.id}`)
    return { ok: true, message: 'Message envoyé.' }
  })
}

export async function updateComplaintStatusAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    const { user } = await requireClassAdmin()
    const parsed = parseForm(complaintStatusSchema, formData)
    if (!parsed.success) {
      return { ok: false, message: parsed.message, fieldErrors: parsed.fieldErrors }
    }

    const existing = await prisma.complaint.findFirst({
      where: { id: parsed.data.complaintId, deletedAt: null },
      select: { id: true, classGroupId: true, authorId: true, title: true, status: true },
    })
    if (!existing) throw new NotFoundError('Réclamation introuvable.')
    assertCanManageClass(user, existing.classGroupId)

    const status = parsed.data.status
    await prisma.complaint.update({
      where: { id: existing.id },
      data: {
        status,
        assignedToId: status === 'EN_COURS' ? user.id : undefined,
        resolvedAt: status === 'RESOLU' ? new Date() : null,
      },
    })

    await recordAudit({
      actor: user,
      action: 'COMPLAINT_STATUS_CHANGED',
      entityType: 'Complaint',
      entityId: existing.id,
      entityLabel: existing.title,
      classGroupId: existing.classGroupId,
      summary: `${user.firstName} ${user.lastName} a passé la réclamation ${existing.title} en ${COMPLAINT_STATUS_LABELS[status]}.`,
      metadata: { from: existing.status, to: status },
    })

    if (existing.authorId !== user.id) {
      await notifyUser(
        existing.authorId,
        {
          type: 'RECLAMATION',
          title: `Réclamation ${COMPLAINT_STATUS_LABELS[status]}`,
          body: existing.title,
          url: `/reclamations/${existing.id}`,
          entityType: 'Complaint',
          entityId: existing.id,
        },
        existing.classGroupId,
      )
    }

    revalidatePath('/reclamations')
    revalidatePath(`/reclamations/${existing.id}`)
    return { ok: true, message: `Statut mis à jour : ${COMPLAINT_STATUS_LABELS[status]}.` }
  })
}
