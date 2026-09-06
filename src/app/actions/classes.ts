'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import { requireClassAdmin, requireUser } from '@/lib/auth/guards'
import { canViewClass } from '@/lib/permissions'
import { recordAudit } from '@/lib/audit'
import { notifyClassStaff, notifyUser } from '@/lib/notifications'
import { AppError, NotFoundError, runAction, type ActionState } from '@/lib/errors'
import {
  classCreateSchema,
  classUpdateSchema,
  invitationSchema,
  joinClassSchema,
  memberRoleSchema,
  memberStudentIdSchema,
  parseForm,
  switchClassSchema,
} from '@/lib/validation'
import {
  countClassAdmins,
  createClassSpace,
  generateClassCode,
  generateInvitationCode,
  joinClass,
  resolveJoinCode,
} from '@/lib/services/classes'
import { MAX_CLASSES_PER_USER } from '@/lib/constants'

/**
 * Cycle de vie des espaces de classe.
 *
 * Toutes les ecritures d'administration passent par requireClassAdmin() :
 * le delegue n'agit que sur SA classe active, et l'identifiant vise est
 * systematiquement recoupe avec cette classe avant toute modification.
 */

// ---------------------------------------------------------------------------
// Creation et adhesion
// ---------------------------------------------------------------------------

export async function createClassAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    const user = await requireUser()
    const parsed = parseForm(classCreateSchema, formData)
    if (!parsed.success) {
      return { ok: false, message: parsed.message, fieldErrors: parsed.fieldErrors }
    }

    // Garde-fou anti-abus : un compte ne peut pas creer un nombre illimite
    // d'espaces.
    const owned = await prisma.membership.count({
      where: { userId: user.id, role: 'ADMIN', isActive: true },
    })
    if (owned >= MAX_CLASSES_PER_USER) {
      return {
        ok: false,
        message: `Vous administrez déjà ${MAX_CLASSES_PER_USER} classes, la limite est atteinte.`,
      }
    }

    const created = await createClassSpace(user.id, {
      name: parsed.data.name,
      schoolName: parsed.data.schoolName,
      programName: parsed.data.programName ?? null,
      levelName: parsed.data.levelName ?? null,
      academicYearLabel: parsed.data.academicYearLabel,
      description: parsed.data.description ?? null,
    })

    await recordAudit({
      actor: user,
      action: 'CLASS_CREATED',
      entityType: 'ClassGroup',
      entityId: created.id,
      entityLabel: `${created.name} (${created.code})`,
      classGroupId: created.id,
      summary: `${user.firstName} ${user.lastName} a créé la classe ${created.name}.`,
    })

    revalidatePath('/', 'layout')
    redirect(`/admin?bienvenue=1`)
  })
}

export async function joinClassAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    const user = await requireUser()
    const parsed = parseForm(joinClassSchema, formData)
    if (!parsed.success) {
      return { ok: false, message: parsed.message, fieldErrors: parsed.fieldErrors }
    }

    const target = await resolveJoinCode(parsed.data.code)
    const result = await joinClass(user.id, target, parsed.data.studentId ?? null)

    if (!result.alreadyMember) {
      await notifyClassStaff(
        target.classGroupId,
        {
          type: 'MEMBRE',
          title: 'Nouveau membre',
          body: `${user.firstName} ${user.lastName} a rejoint la classe.`,
          url: '/admin/membres',
          entityType: 'User',
          entityId: user.id,
        },
        { excludeUserId: user.id },
      )
      await recordAudit({
        actor: user,
        action: 'CLASS_JOINED',
        entityType: 'ClassGroup',
        entityId: target.classGroupId,
        entityLabel: target.className,
        classGroupId: target.classGroupId,
        summary: `${user.firstName} ${user.lastName} a rejoint la classe ${target.className}.`,
      })
    }

    revalidatePath('/', 'layout')
    redirect('/dashboard')
  })
}

/**
 * Variante sans etat, pour un formulaire simple (lien d'invitation).
 * Une erreur y remonte comme une erreur de page plutot que comme un
 * message de champ : ce formulaire n'a pas d'etat a afficher.
 */
export async function joinClassFormAction(formData: FormData): Promise<void> {
  const result = await joinClassAction({ ok: false }, formData)
  if (!result.ok && result.message) throw new AppError(result.message)
}

/** Change l'espace de travail affiche. Refuse toute classe non rejointe. */
export async function switchClassAction(formData: FormData): Promise<void> {
  const user = await requireUser()
  const parsed = parseForm(switchClassSchema, formData)
  if (!parsed.success) throw new AppError(parsed.message)

  if (!canViewClass(user, parsed.data.classGroupId)) {
    throw new NotFoundError('Classe introuvable.')
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { activeClassGroupId: parsed.data.classGroupId },
  })

  revalidatePath('/', 'layout')
  redirect('/dashboard')
}

/** Quitte une classe. Le dernier delegue doit d'abord nommer un successeur. */
export async function leaveClassAction(formData: FormData): Promise<void> {
  const user = await requireUser()
  const classGroupId = String(formData.get('classGroupId') ?? '')
  if (!canViewClass(user, classGroupId)) throw new NotFoundError('Classe introuvable.')

  const membership = await prisma.membership.findUnique({
    where: { userId_classGroupId: { userId: user.id, classGroupId } },
    select: { id: true, role: true, classGroup: { select: { name: true } } },
  })
  if (!membership) throw new NotFoundError('Classe introuvable.')

  if (membership.role === 'ADMIN' && (await countClassAdmins(classGroupId)) <= 1) {
    throw new AppError(
      'Vous êtes le seul délégué de cette classe : nommez un autre délégué avant de la quitter.',
    )
  }

  await prisma.$transaction(async (tx) => {
    await tx.membership.update({
      where: { id: membership.id },
      data: { isActive: false },
    })
    const fallback = await tx.membership.findFirst({
      where: { userId: user.id, isActive: true, classGroupId: { not: classGroupId } },
      select: { classGroupId: true },
      orderBy: { joinedAt: 'asc' },
    })
    await tx.user.update({
      where: { id: user.id },
      data: { activeClassGroupId: fallback?.classGroupId ?? null },
    })
  })

  await recordAudit({
    actor: user,
    action: 'CLASS_LEFT',
    entityType: 'ClassGroup',
    entityId: classGroupId,
    entityLabel: membership.classGroup.name,
    classGroupId,
    summary: `${user.firstName} ${user.lastName} a quitté la classe ${membership.classGroup.name}.`,
  })

  revalidatePath('/', 'layout')
  redirect('/classes')
}

// ---------------------------------------------------------------------------
// Parametres de la classe
// ---------------------------------------------------------------------------

export async function updateClassAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    const { user, classId } = await requireClassAdmin()
    const parsed = parseForm(classUpdateSchema, formData)
    if (!parsed.success) {
      return { ok: false, message: parsed.message, fieldErrors: parsed.fieldErrors }
    }

    const updated = await prisma.classGroup.update({
      where: { id: classId },
      data: {
        name: parsed.data.name,
        schoolName: parsed.data.schoolName,
        programName: parsed.data.programName ?? null,
        levelName: parsed.data.levelName ?? null,
        description: parsed.data.description ?? null,
      },
      select: { name: true },
    })

    await recordAudit({
      actor: user,
      action: 'CLASS_UPDATED',
      entityType: 'ClassGroup',
      entityId: classId,
      entityLabel: updated.name,
      classGroupId: classId,
      summary: `${user.firstName} ${user.lastName} a modifié les paramètres de la classe.`,
    })

    revalidatePath('/', 'layout')
    return { ok: true, message: 'Paramètres de la classe mis à jour.' }
  })
}

/** Regenere le code d'inscription : coupe l'acces aux anciens partages. */
export async function rotateClassCodeAction(): Promise<void> {
  const { user, classId } = await requireClassAdmin()
  const code = await generateClassCode()

  await prisma.classGroup.update({ where: { id: classId }, data: { code } })

  await recordAudit({
    actor: user,
    action: 'CLASS_CODE_ROTATED',
    entityType: 'ClassGroup',
    entityId: classId,
    classGroupId: classId,
    summary: `${user.firstName} ${user.lastName} a regenere le code d inscription de la classe.`,
  })

  revalidatePath('/', 'layout')
}

// ---------------------------------------------------------------------------
// Invitations
// ---------------------------------------------------------------------------

export async function createInvitationAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    const { user, classId } = await requireClassAdmin()
    const parsed = parseForm(invitationSchema, formData)
    if (!parsed.success) {
      return { ok: false, message: parsed.message, fieldErrors: parsed.fieldErrors }
    }

    const code = await generateInvitationCode()
    await prisma.invitation.create({
      data: {
        classGroupId: classId,
        code,
        role: parsed.data.role,
        email: parsed.data.email ?? null,
        label: parsed.data.label ?? null,
        maxUses: parsed.data.maxUses,
        expiresAt: new Date(Date.now() + parsed.data.days * 86_400_000),
        createdById: user.id,
      },
    })

    await recordAudit({
      actor: user,
      action: 'INVITATION_CREATED',
      entityType: 'Invitation',
      entityLabel: parsed.data.label ?? code,
      classGroupId: classId,
      summary: `${user.firstName} ${user.lastName} a créé un lien d’invitation.`,
      metadata: { role: parsed.data.role, days: parsed.data.days },
    })

    revalidatePath('/admin/membres')
    return { ok: true, message: 'Lien d’invitation créé.' }
  })
}

export async function revokeInvitationAction(formData: FormData): Promise<void> {
  const { user, classId } = await requireClassAdmin()
  const invitationId = String(formData.get('invitationId') ?? '')

  // Le filtre sur classGroupId interdit de revoquer l'invitation d'une
  // autre classe en changeant l'identifiant.
  const result = await prisma.invitation.updateMany({
    where: { id: invitationId, classGroupId: classId, revokedAt: null },
    data: { revokedAt: new Date() },
  })
  if (result.count === 0) throw new NotFoundError('Invitation introuvable.')

  await recordAudit({
    actor: user,
    action: 'INVITATION_REVOKED',
    entityType: 'Invitation',
    entityId: invitationId,
    classGroupId: classId,
    summary: `${user.firstName} ${user.lastName} a révoqué un lien d’invitation.`,
  })

  revalidatePath('/admin/membres')
}

// ---------------------------------------------------------------------------
// Membres
// ---------------------------------------------------------------------------

/** Charge une appartenance en verifiant qu'elle est bien dans MA classe. */
async function loadMembership(membershipId: string, classId: string) {
  const membership = await prisma.membership.findFirst({
    where: { id: membershipId, classGroupId: classId },
    select: {
      id: true,
      role: true,
      userId: true,
      isActive: true,
      user: { select: { firstName: true, lastName: true } },
    },
  })
  if (!membership) throw new NotFoundError('Membre introuvable dans cette classe.')
  return membership
}

export async function changeMemberRoleAction(formData: FormData): Promise<void> {
  const { user, classId } = await requireClassAdmin()
  const parsed = parseForm(memberRoleSchema, formData)
  if (!parsed.success) throw new AppError(parsed.message)

  const membership = await loadMembership(parsed.data.membershipId, classId)

  // Personne ne modifie son propre role : ni auto-promotion, ni retrait
  // accidentel du dernier delegue.
  if (membership.userId === user.id) {
    throw new AppError('Vous ne pouvez pas modifier votre propre role.')
  }
  if (
    membership.role === 'ADMIN' &&
    parsed.data.role === 'MEMBER' &&
    (await countClassAdmins(classId)) <= 1
  ) {
    throw new AppError('La classe doit conserver au moins un delegue.')
  }

  await prisma.membership.update({
    where: { id: membership.id },
    data: { role: parsed.data.role },
  })

  await notifyUser(
    membership.userId,
    {
      type: 'MEMBRE',
      title: parsed.data.role === 'ADMIN' ? 'Vous etes delegue' : 'Role mis a jour',
      body:
        parsed.data.role === 'ADMIN'
          ? 'Vous pouvez desormais administrer la classe.'
          : 'Vos droits d administration ont ete retires.',
      url: '/dashboard',
    },
    classId,
  )

  await recordAudit({
    actor: user,
    action: 'MEMBER_ROLE_CHANGED',
    entityType: 'Membership',
    entityId: membership.id,
    entityLabel: `${membership.user.firstName} ${membership.user.lastName}`,
    classGroupId: classId,
    summary: `${user.firstName} ${user.lastName} a change le role de ${membership.user.firstName} ${membership.user.lastName}.`,
    metadata: { from: membership.role, to: parsed.data.role },
  })

  revalidatePath('/admin/membres')
}

export async function updateMemberStudentIdAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    const { user, classId } = await requireClassAdmin()
    const parsed = parseForm(memberStudentIdSchema, formData)
    if (!parsed.success) {
      return { ok: false, message: parsed.message, fieldErrors: parsed.fieldErrors }
    }
    const membership = await loadMembership(parsed.data.membershipId, classId)

    if (parsed.data.studentId) {
      const duplicate = await prisma.membership.findFirst({
        where: {
          classGroupId: classId,
          studentId: parsed.data.studentId,
          id: { not: membership.id },
        },
        select: { id: true },
      })
      if (duplicate) {
        return {
          ok: false,
          message: 'Ce numero etudiant est deja utilise dans la classe.',
          fieldErrors: { studentId: ['Numero deja utilise.'] },
        }
      }
    }

    await prisma.membership.update({
      where: { id: membership.id },
      data: { studentId: parsed.data.studentId ?? null },
    })

    await recordAudit({
      actor: user,
      action: 'MEMBER_UPDATED',
      entityType: 'Membership',
      entityId: membership.id,
      entityLabel: `${membership.user.firstName} ${membership.user.lastName}`,
      classGroupId: classId,
      summary: `${user.firstName} ${user.lastName} a mis a jour le numero etudiant de ${membership.user.firstName} ${membership.user.lastName}.`,
    })

    revalidatePath('/admin/membres')
    return { ok: true, message: 'Numero etudiant mis a jour.' }
  })
}

/**
 * Retire un membre de la classe.
 * L'appartenance est desactivee, le compte n'est pas supprime : ses
 * contributions restent attribuees et il peut etre reinvite plus tard.
 */
export async function removeMemberAction(formData: FormData): Promise<void> {
  const { user, classId } = await requireClassAdmin()
  const membershipId = String(formData.get('membershipId') ?? '')
  const membership = await loadMembership(membershipId, classId)

  if (membership.userId === user.id) {
    throw new AppError(
      'Vous ne pouvez pas vous retirer vous-meme : utilisez "Quitter la classe".',
    )
  }
  if (membership.role === 'ADMIN' && (await countClassAdmins(classId)) <= 1) {
    throw new AppError('La classe doit conserver au moins un delegue.')
  }

  await prisma.$transaction(async (tx) => {
    await tx.membership.update({
      where: { id: membership.id },
      data: { isActive: false },
    })
    // Le membre retire ne doit plus arriver sur cet espace a sa prochaine
    // visite : sa classe active bascule sur une autre de ses classes.
    const fallback = await tx.membership.findFirst({
      where: {
        userId: membership.userId,
        isActive: true,
        classGroupId: { not: classId },
      },
      select: { classGroupId: true },
      orderBy: { joinedAt: 'asc' },
    })
    await tx.user.updateMany({
      where: { id: membership.userId, activeClassGroupId: classId },
      data: { activeClassGroupId: fallback?.classGroupId ?? null },
    })
  })

  await notifyUser(
    membership.userId,
    {
      type: 'MEMBRE',
      title: 'Retrait de la classe',
      body: 'Votre accès à cette classe a été retiré par le délégué.',
    },
    null,
  )

  await recordAudit({
    actor: user,
    action: 'MEMBER_REMOVED',
    entityType: 'Membership',
    entityId: membership.id,
    entityLabel: `${membership.user.firstName} ${membership.user.lastName}`,
    classGroupId: classId,
    summary: `${user.firstName} ${user.lastName} a retire ${membership.user.firstName} ${membership.user.lastName} de la classe.`,
  })

  revalidatePath('/admin/membres')
}
