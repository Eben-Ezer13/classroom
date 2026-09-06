import 'server-only'
import { prisma } from '@/lib/db'

/**
 * Contexte academique d'une classe : semestres et modules disponibles.
 * Alimente tous les selecteurs des formulaires.
 *
 * Chaque requete part du classGroupId : les listes proposees a un delegue
 * ne contiennent jamais le calendrier ni les modules d'une autre classe,
 * ce qui rend impossible le rattachement croise d'un contenu.
 */

export async function getClassSemesters(classGroupId: string) {
  return prisma.semester.findMany({
    where: { academicYear: { classGroupId } },
    select: {
      id: true,
      label: true,
      number: true,
      isCurrent: true,
      isArchived: true,
      startsAt: true,
      endsAt: true,
      academicYear: { select: { id: true, label: true, isCurrent: true, isArchived: true } },
    },
    orderBy: [{ academicYear: { startsAt: 'desc' } }, { number: 'asc' }],
  })
}

export async function getClassYears(classGroupId: string) {
  return prisma.academicYear.findMany({
    where: { classGroupId },
    select: {
      id: true,
      label: true,
      startsAt: true,
      endsAt: true,
      isCurrent: true,
      isArchived: true,
      semesters: {
        select: {
          id: true,
          number: true,
          label: true,
          startsAt: true,
          endsAt: true,
          isCurrent: true,
          isArchived: true,
          _count: { select: { modules: true, resources: true } },
        },
        orderBy: { number: 'asc' },
      },
    },
    orderBy: { startsAt: 'desc' },
  })
}

export async function getClassModules(classGroupId: string, semesterId?: string) {
  return prisma.module.findMany({
    where: {
      classGroupId,
      deletedAt: null,
      isActive: true,
      ...(semesterId ? { semesterId } : {}),
    },
    select: {
      id: true,
      code: true,
      name: true,
      color: true,
      teacherName: true,
      semesterId: true,
      semester: { select: { label: true, isArchived: true } },
    },
    orderBy: [{ semester: { number: 'asc' } }, { code: 'asc' }],
  })
}

/** Semestre a preselectionner dans les formulaires. */
export async function getDefaultSemesterId(classGroupId: string): Promise<string | null> {
  const semesters = await getClassSemesters(classGroupId)
  const current = semesters.find((s) => s.isCurrent && !s.isArchived)
  if (current) return current.id
  const firstActive = semesters.find((s) => !s.isArchived)
  return firstActive?.id ?? semesters[0]?.id ?? null
}

/** Fiche complete de la classe, pour l'espace d'administration. */
export async function getClassProfile(classGroupId: string) {
  return prisma.classGroup.findUnique({
    where: { id: classGroupId },
    select: {
      id: true,
      name: true,
      code: true,
      schoolName: true,
      programName: true,
      levelName: true,
      description: true,
      isActive: true,
      storageUsed: true,
      storageQuota: true,
      createdAt: true,
      createdBy: { select: { firstName: true, lastName: true } },
    },
  })
}
