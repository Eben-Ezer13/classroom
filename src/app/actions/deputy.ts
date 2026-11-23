'use server'

import { prisma } from '@/lib/db'
import { requireClassAdmin, requireUser } from '@/lib/auth/guards'
import { notifyClassStaff, notifyUser } from '@/lib/notifications'
import { runAction, NotFoundError, type ActionState } from '@/lib/errors'

const ALLOWED = new Set(['ECHEANCES', 'PROJETS'])

/** Le délégué principal choisit l'adjoint de sa classe (un seul à la fois). */
export async function assignDeputyAction(formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const { classId } = await requireClassAdmin()
    const membershipId = String(formData.get('membershipId') ?? '')
    const enabled = String(formData.get('enabled') ?? '') === 'true'
    const membership = await prisma.membership.findFirst({
      where: { id: membershipId, classGroupId: classId, role: 'MEMBER', isActive: true },
      select: { id: true },
    })
    if (!membership) throw new NotFoundError('Étudiant introuvable.')

    await prisma.$transaction(async (tx) => {
      await tx.membership.updateMany({
        where: { classGroupId: classId, isDeputy: true },
        data: { isDeputy: false, delegatedPermissions: [] },
      })
      if (enabled) await tx.membership.update({
        where: { id: membership.id },
        data: { isDeputy: true },
      })
    })
    return { ok: true, message: enabled ? 'Délégué adjoint désigné.' : 'Délégué adjoint retiré.' }
  })
}

/** Demande d'accès limitée aux tâches que la plateforme sait déléguer. */
export async function requestDeputyPermissionAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    const user = await requireUser()
    const classId = user.classGroupId
    if (!classId) throw new NotFoundError('Classe introuvable.')
    const membership = user.memberships.find((item) => item.classGroupId === classId)
    if (!membership?.isDeputy) throw new NotFoundError('Accès réservé au délégué adjoint.')
    const permission = String(formData.get('permission') ?? '')
    if (!ALLOWED.has(permission)) return { ok: false, message: 'Autorisation inconnue.' }
    const alreadyGranted = membership.delegatedPermissions.includes(permission)
    if (alreadyGranted) return { ok: false, message: 'Cette autorisation vous est déjà accordée.' }

    const existing = await prisma.permissionRequest.findFirst({
      where: { classGroupId: classId, userId: user.id, permission, status: 'PENDING' },
      select: { id: true },
    })
    if (existing) return { ok: false, message: 'Une demande est déjà en attente.' }

    const request = await prisma.permissionRequest.create({
      data: { classGroupId: classId, userId: user.id, permission, message: String(formData.get('message') ?? '').trim().slice(0, 500) || null },
    })
    await notifyClassStaff(classId, {
      type: 'AUTORISATION',
      title: 'Demande d’autorisation',
      body: `${user.firstName} ${user.lastName} demande l’accès à ${permission === 'ECHEANCES' ? 'la gestion des échéances' : 'la gestion des projets'}.`,
      url: '/admin/membres?autorisations=1',
      entityType: 'PermissionRequest',
      entityId: request.id,
    })
    return { ok: true, message: 'Demande envoyée au délégué principal.' }
  })
}

/** Seul un principal de la classe peut accorder ou refuser une demande. */
export async function reviewDeputyPermissionAction(formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const { user, classId } = await requireClassAdmin()
    const requestId = String(formData.get('requestId') ?? '')
    const approve = String(formData.get('approve') ?? '') === 'true'
    const request = await prisma.permissionRequest.findFirst({
      where: { id: requestId, classGroupId: classId, status: 'PENDING', permission: { in: [...ALLOWED] } },
      select: { id: true, userId: true, permission: true },
    })
    if (!request) throw new NotFoundError('Demande introuvable ou déjà traitée.')

    await prisma.$transaction(async (tx) => {
      const claimed = await tx.permissionRequest.updateMany({
        where: { id: request.id, status: 'PENDING' },
        data: { status: approve ? 'APPROVED' : 'REJECTED', reviewedById: user.id, reviewedAt: new Date() },
      })
      if (claimed.count !== 1) throw new NotFoundError('Demande déjà traitée.')
      if (approve) {
        await tx.membership.updateMany({
          where: { classGroupId: classId, userId: request.userId, isActive: true, isDeputy: true },
          data: { delegatedPermissions: { push: request.permission } },
        })
      }
    })
    await notifyUser(request.userId, {
      type: 'AUTORISATION',
      title: approve ? 'Autorisation accordée' : 'Demande refusée',
      body: approve ? 'Le délégué principal vous a accordé l’autorisation demandée.' : 'Le délégué principal a refusé votre demande.',
      url: '/echeances',
      entityType: 'PermissionRequest',
      entityId: request.id,
    }, classId)
    return { ok: true, message: approve ? 'Autorisation accordée.' : 'Demande refusée.' }
  })
}
