'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/db'
import { requireClassAdmin } from '@/lib/auth/guards'
import { recordAudit } from '@/lib/audit'
import { runAction, AppError, NotFoundError, type ActionState } from '@/lib/errors'
import { academicYearSchema, parseForm, semesterSchema } from '@/lib/validation'

/**
 * Calendrier academique de la classe : annees, semestres, archivage.
 *
 * Chaque action commence par requireClassAdmin() et ne touche qu'a la
 * classe active. Un delegue ne peut donc pas modifier le calendrier d'une
 * autre classe, meme en envoyant l'identifiant d'une de ses annees.
 */

/** Verifie que l'annee visee appartient bien a la classe du delegue. */
async function loadYear(yearId: string, classGroupId: string) {
  const year = await prisma.academicYear.findFirst({
    where: { id: yearId, classGroupId },
    select: { id: true, label: true, isArchived: true },
  })
  if (!year) throw new NotFoundError('Année introuvable dans cette classe.')
  return year
}

// ---------------------------------------------------------------------------
// Annees academiques
// ---------------------------------------------------------------------------

export async function createAcademicYearAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    const { user, classId } = await requireClassAdmin()
    const parsed = parseForm(academicYearSchema, formData)
    if (!parsed.success) {
      return { ok: false, message: parsed.message, fieldErrors: parsed.fieldErrors }
    }
    const data = parsed.data

    const exists = await prisma.academicYear.findFirst({
      where: { classGroupId: classId, label: data.label },
      select: { id: true },
    })
    if (exists) {
      return {
        ok: false,
        message: 'Cette année existe déjà pour votre classe.',
        fieldErrors: { label: ['Libelle deja utilise.'] },
      }
    }

    const created = await prisma.$transaction(async (tx) => {
      // Une seule annee courante par classe : on retire le drapeau des
      // autres avant de le poser.
      if (data.isCurrent) {
        await tx.academicYear.updateMany({
          where: { classGroupId: classId, isCurrent: true },
          data: { isCurrent: false },
        })
      }
      return tx.academicYear.create({
        data: {
          classGroupId: classId,
          label: data.label,
          startsAt: data.startsAt,
          endsAt: data.endsAt,
          isCurrent: data.isCurrent,
        },
        select: { id: true, label: true },
      })
    })

    await recordAudit({
      actor: user,
      action: 'ACADEMIC_YEAR_CREATED',
      entityType: 'AcademicYear',
      entityId: created.id,
      entityLabel: created.label,
      classGroupId: classId,
      summary: `${user.firstName} ${user.lastName} a créé l’année ${created.label}.`,
    })

    revalidatePath('/admin/annees')
    return { ok: true, message: 'Année académique créée.' }
  })
}

export async function createSemesterAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    const { user, classId } = await requireClassAdmin()
    const parsed = parseForm(semesterSchema, formData)
    if (!parsed.success) {
      return { ok: false, message: parsed.message, fieldErrors: parsed.fieldErrors }
    }
    const data = parsed.data

    // L'annee doit appartenir a la classe : sans ce controle, un semestre
    // pourrait etre greffe sur le calendrier d'une autre classe.
    await loadYear(data.academicYearId, classId)

    const exists = await prisma.semester.findFirst({
      where: { academicYearId: data.academicYearId, number: data.number },
      select: { id: true },
    })
    if (exists) {
      return {
        ok: false,
        message: 'Ce numéro de semestre existe déjà pour cette année.',
        fieldErrors: { number: ['Numéro déjà utilisé.'] },
      }
    }

    const created = await prisma.$transaction(async (tx) => {
      if (data.isCurrent) {
        await tx.semester.updateMany({
          where: { academicYear: { classGroupId: classId }, isCurrent: true },
          data: { isCurrent: false },
        })
      }
      return tx.semester.create({
        data: {
          academicYearId: data.academicYearId,
          number: data.number,
          label: data.label,
          startsAt: data.startsAt,
          endsAt: data.endsAt,
          isCurrent: data.isCurrent,
        },
        select: { id: true, label: true },
      })
    })

    await recordAudit({
      actor: user,
      action: 'SEMESTER_CREATED',
      entityType: 'Semester',
      entityId: created.id,
      entityLabel: created.label,
      classGroupId: classId,
      summary: `${user.firstName} ${user.lastName} a créé le semestre ${created.label}.`,
    })

    revalidatePath('/admin/annees')
    return { ok: true, message: 'Semestre créé.' }
  })
}

// ---------------------------------------------------------------------------
// Archivage
// ---------------------------------------------------------------------------

export async function toggleYearArchiveAction(formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const { user, classId } = await requireClassAdmin()
    const yearId = String(formData.get('yearId') ?? '')
    const year = await loadYear(yearId, classId)

    const archived = !year.isArchived

    // Archiver une annee archive ses semestres et les ressources associees,
    // et retire son statut courant : les donnees anciennes ne se melangent
    // plus a l'annee en cours.
    await prisma.$transaction([
      prisma.academicYear.update({
        where: { id: yearId },
        data: { isArchived: archived, isCurrent: archived ? false : undefined },
      }),
      prisma.semester.updateMany({
        where: { academicYearId: yearId },
        data: { isArchived: archived, isCurrent: archived ? false : undefined },
      }),
      prisma.resource.updateMany({
        where: {
          classGroupId: classId,
          semester: { academicYearId: yearId },
          deletedAt: null,
        },
        data: { isArchived: archived },
      }),
    ])

    await recordAudit({
      actor: user,
      action: archived ? 'YEAR_ARCHIVED' : 'YEAR_UNARCHIVED',
      entityType: 'AcademicYear',
      entityId: year.id,
      entityLabel: year.label,
      classGroupId: classId,
      summary: `${user.firstName} ${user.lastName} a ${archived ? 'archivé' : 'désarchivé'} l’année ${year.label}.`,
    })

    revalidatePath('/admin/archives')
    revalidatePath('/admin/annees')
    return {
      ok: true,
      message: archived ? `Année ${year.label} archivée.` : `Année ${year.label} désarchivée.`,
    }
  })
}

export async function setCurrentYearAction(formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const { user, classId } = await requireClassAdmin()
    const yearId = String(formData.get('yearId') ?? '')
    const year = await loadYear(yearId, classId)

    if (year.isArchived) {
      throw new AppError('Désarchivez cette année avant de la définir comme courante.')
    }

    await prisma.$transaction([
      prisma.academicYear.updateMany({
        where: { classGroupId: classId, isCurrent: true },
        data: { isCurrent: false },
      }),
      prisma.academicYear.update({ where: { id: yearId }, data: { isCurrent: true } }),
    ])

    await recordAudit({
      actor: user,
      action: 'YEAR_SET_CURRENT',
      entityType: 'AcademicYear',
      entityId: year.id,
      entityLabel: year.label,
      classGroupId: classId,
      summary: `${user.firstName} ${user.lastName} a défini ${year.label} comme année courante.`,
    })

    revalidatePath('/admin/annees')
    return { ok: true, message: `${year.label} est l’année courante.` }
  })
}

export async function setCurrentSemesterAction(formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const { user, classId } = await requireClassAdmin()
    const semesterId = String(formData.get('semesterId') ?? '')

    const semester = await prisma.semester.findFirst({
      where: { id: semesterId, academicYear: { classGroupId: classId } },
      select: { id: true, label: true, isArchived: true },
    })
    if (!semester) throw new NotFoundError('Semestre introuvable dans cette classe.')
    if (semester.isArchived) {
      throw new AppError('Désarchivez ce semestre avant de le définir comme courant.')
    }

    await prisma.$transaction([
      prisma.semester.updateMany({
        where: { academicYear: { classGroupId: classId }, isCurrent: true },
        data: { isCurrent: false },
      }),
      prisma.semester.update({ where: { id: semesterId }, data: { isCurrent: true } }),
    ])

    await recordAudit({
      actor: user,
      action: 'SEMESTER_SET_CURRENT',
      entityType: 'Semester',
      entityId: semester.id,
      entityLabel: semester.label,
      classGroupId: classId,
      summary: `${user.firstName} ${user.lastName} a défini ${semester.label} comme semestre courant.`,
    })

    revalidatePath('/admin/annees')
    return { ok: true, message: `${semester.label} est le semestre courant.` }
  })
}
