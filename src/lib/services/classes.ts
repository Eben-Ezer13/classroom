import 'server-only'
import { randomInt } from 'crypto'
import { prisma } from '@/lib/db'
import type { Prisma } from '@prisma/client'
import {
  CLASS_CODE_LENGTH,
  CODE_ALPHABET,
  INVITATION_CODE_LENGTH,
  MAX_STUDENTS_PER_CLASS,
  ONLINE_WINDOW_MS,
} from '@/lib/constants'
import { AppError } from '@/lib/errors'

/**
 * Cycle de vie d'une classe : creation autonome par un delegue, adhesion
 * par code, presence des membres.
 *
 * Chaque classe creee ici est un espace complet et independant : ses
 * membres, son calendrier academique et son stockage lui appartiennent.
 */

/** Code aleatoire lisible (sans 0/O ni 1/I), tire d'une source sure. */
function randomCode(length: number): string {
  let out = ''
  for (let i = 0; i < length; i += 1) {
    out += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]
  }
  return out
}

/** Code unique de classe. Reessaye en cas de collision (probabilite infime). */
export async function generateClassCode(): Promise<string> {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const code = randomCode(CLASS_CODE_LENGTH)
    const exists = await prisma.classGroup.findUnique({
      where: { code },
      select: { id: true },
    })
    if (!exists) return code
  }
  throw new AppError('Impossible de generer un code de classe, reessayez.')
}

export async function generateInvitationCode(): Promise<string> {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const code = randomCode(INVITATION_CODE_LENGTH)
    const exists = await prisma.invitation.findUnique({
      where: { code },
      select: { id: true },
    })
    if (!exists) return code
  }
  throw new AppError("Impossible de generer un lien d'invitation, reessayez.")
}

export type NewClassInput = {
  name: string
  schoolName: string
  programName?: string | null
  levelName?: string | null
  academicYearLabel: string
  description?: string | null
}

/**
 * Cree une classe et son espace complet, en une seule transaction :
 *   - la classe et son code d'inscription ;
 *   - l'appartenance ADMIN du createur (le delegue principal) ;
 *   - l'annee academique et deux semestres, pour que modules, ressources
 *     et programme soient utilisables immediatement.
 *
 * Tout est cree ou rien ne l'est : pas de classe a moitie initialisee.
 */
export async function createClassSpace(
  userId: string,
  input: NewClassInput,
): Promise<{ id: string; code: string; name: string }> {
  const code = await generateClassCode()
  const year = parseAcademicYear(input.academicYearLabel)

  return prisma.$transaction(async (tx) => {
    // Un etudiant ne peut pas administrer une nouvelle classe tout en etant
    // membre actif d'une autre. Les delegues peuvent en revanche gerer
    // plusieurs classes s'ils n'y sont pas inscrits comme etudiants.
    const activeStudentMembership = await tx.membership.findFirst({
      where: { userId, role: 'MEMBER', isActive: true },
      select: { id: true },
    })
    if (activeStudentMembership) {
      throw new AppError(
        'Vous appartenez deja a une classe en tant qu etudiant. Quittez-la avant de creer une autre classe.',
      )
    }

    const classGroup = await tx.classGroup.create({
      data: {
        name: input.name,
        code,
        schoolName: input.schoolName,
        programName: input.programName ?? null,
        levelName: input.levelName ?? null,
        description: input.description ?? null,
        createdById: userId,
      },
      select: { id: true, code: true, name: true },
    })

    await tx.membership.create({
      data: { userId, classGroupId: classGroup.id, role: 'ADMIN' },
    })

    const academicYear = await tx.academicYear.create({
      data: {
        classGroupId: classGroup.id,
        label: input.academicYearLabel,
        startsAt: year.startsAt,
        endsAt: year.endsAt,
        isCurrent: true,
      },
      select: { id: true },
    })

    await tx.semester.createMany({
      data: [
        {
          academicYearId: academicYear.id,
          number: 1,
          label: `Semestre 1 — ${input.academicYearLabel}`,
          startsAt: year.startsAt,
          endsAt: year.midPoint,
          isCurrent: year.currentSemester === 1,
        },
        {
          academicYearId: academicYear.id,
          number: 2,
          label: `Semestre 2 — ${input.academicYearLabel}`,
          startsAt: year.midPoint,
          endsAt: year.endsAt,
          isCurrent: year.currentSemester === 2,
        },
      ],
    })

    await tx.user.update({
      where: { id: userId },
      data: { activeClassGroupId: classGroup.id },
    })

    return classGroup
  })
}

/**
 * Bornes d'une annee academique a partir de son libelle ("2025/2026").
 * Par defaut : 1er septembre -> 31 aout, decoupe en deux semestres au
 * 1er fevrier. Le delegue peut ensuite ajuster.
 */
function parseAcademicYear(label: string): {
  startsAt: Date
  endsAt: Date
  midPoint: Date
  currentSemester: 1 | 2
} {
  const match = label.match(/(20\d{2})/)
  const startYear = match ? Number(match[1]) : new Date().getFullYear()
  const startsAt = new Date(Date.UTC(startYear, 8, 1))
  const midPoint = new Date(Date.UTC(startYear + 1, 1, 1))
  const endsAt = new Date(Date.UTC(startYear + 1, 7, 31))
  const now = Date.now()
  return {
    startsAt,
    endsAt,
    midPoint,
    currentSemester: now >= midPoint.getTime() ? 2 : 1,
  }
}

export type JoinTarget = {
  classGroupId: string
  className: string
  schoolName: string
  role: 'ADMIN' | 'MEMBER'
  invitationId: string | null
}

/**
 * Resout un code saisi par un etudiant : code permanent de la classe ou
 * lien d'invitation. Les messages distinguent explicitement le code
 * inconnu, l'invitation expiree et l'invitation epuisee.
 */
export async function resolveJoinCode(rawCode: string): Promise<JoinTarget> {
  const code = rawCode.trim().toUpperCase()
  if (!code) throw new AppError("Saisissez un code d'invitation.")

  const invitation = await prisma.invitation.findUnique({
    where: { code },
    select: {
      id: true,
      role: true,
      expiresAt: true,
      revokedAt: true,
      maxUses: true,
      usedCount: true,
      classGroup: {
        select: { id: true, name: true, schoolName: true, isActive: true, deletedAt: true },
      },
    },
  })

  if (invitation) {
    if (invitation.revokedAt) {
      throw new AppError("Cette invitation a ete revoquee par le delegue.", 410)
    }
    if (invitation.expiresAt && invitation.expiresAt.getTime() < Date.now()) {
      throw new AppError('Cette invitation a expire. Demandez un nouveau lien.', 410)
    }
    if (invitation.maxUses > 0 && invitation.usedCount >= invitation.maxUses) {
      throw new AppError(
        "Cette invitation a atteint son nombre maximal d'utilisations.",
        410,
      )
    }
    if (!invitation.classGroup.isActive || invitation.classGroup.deletedAt) {
      throw new AppError("Cette classe n'est plus active.", 410)
    }
    return {
      classGroupId: invitation.classGroup.id,
      className: invitation.classGroup.name,
      schoolName: invitation.classGroup.schoolName,
      role: invitation.role,
      invitationId: invitation.id,
    }
  }

  const classGroup = await prisma.classGroup.findFirst({
    where: { code, isActive: true, deletedAt: null },
    select: { id: true, name: true, schoolName: true },
  })
  if (!classGroup) {
    throw new AppError(
      'Code inconnu. Verifiez le code fourni par votre delegue.',
      404,
    )
  }
  return {
    classGroupId: classGroup.id,
    className: classGroup.name,
    schoolName: classGroup.schoolName,
    role: 'MEMBER',
    invitationId: null,
  }
}

/**
 * Rattache un utilisateur a une classe.
 * Reactive une appartenance existante plutot que d'en creer une seconde :
 * un etudiant retire puis reinvite retrouve son espace sans doublon, et
 * ses contributions restent attachees a son compte.
 */
export async function joinClass(
  userId: string,
  target: JoinTarget,
  studentId?: string | null,
): Promise<{ alreadyMember: boolean }> {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.membership.findUnique({
      where: { userId_classGroupId: { userId, classGroupId: target.classGroupId } },
      select: { id: true, isActive: true, role: true },
    })

    if (existing?.isActive) {
      await tx.user.update({
        where: { id: userId },
        data: { activeClassGroupId: target.classGroupId },
      })
      return { alreadyMember: true }
    }

    // Un eleve n'a qu'une seule classe active. Cette verification applicative
    // donne un message clair ; la contrainte PostgreSQL protege aussi les
    // ecritures concurrentes ou un futur point d'entree API.
    const activeStudentMembership = await tx.membership.findFirst({
      where: {
        userId,
        role: 'MEMBER',
        isActive: true,
        classGroupId: { not: target.classGroupId },
      },
      select: { classGroup: { select: { name: true } } },
    })
    if (activeStudentMembership) {
      throw new AppError(
        `Vous appartenez deja a la classe ${activeStudentMembership.classGroup.name}. Quittez-la avant d en rejoindre une autre.`,
      )
    }

    const joiningRole = existing?.role ?? target.role
    if (joiningRole === 'MEMBER') {
      const studentCount = await tx.membership.count({
        where: { classGroupId: target.classGroupId, role: 'MEMBER', isActive: true },
      })
      if (studentCount >= MAX_STUDENTS_PER_CLASS) {
        throw new AppError(
          `Cette classe a atteint sa capacite de ${MAX_STUDENTS_PER_CLASS} etudiants.`,
        )
      }
    }

    if (existing) {
      await tx.membership.update({
        where: { id: existing.id },
        data: { isActive: true, ...(studentId ? { studentId } : {}) },
      })
    } else {
      await tx.membership.create({
        data: {
          userId,
          classGroupId: target.classGroupId,
          role: target.role,
          studentId: studentId || null,
        },
      })
    }

    if (target.invitationId) {
      await tx.invitation.update({
        where: { id: target.invitationId },
        data: { usedCount: { increment: 1 } },
      })
    }

    await tx.user.update({
      where: { id: userId },
      data: { activeClassGroupId: target.classGroupId },
    })

    return { alreadyMember: false }
  })
}

// ---------------------------------------------------------------------------
// Membres et presence
// ---------------------------------------------------------------------------

/** Un membre est "en ligne" si une activite a ete constatee recemment. */
export function isOnline(lastSeenAt: Date | null | undefined): boolean {
  if (!lastSeenAt) return false
  return Date.now() - lastSeenAt.getTime() < ONLINE_WINDOW_MS
}

export type ClassMember = {
  membershipId: string
  userId: string
  firstName: string
  lastName: string
  email: string
  avatarUrl: string | null
  role: 'ADMIN' | 'MEMBER'
  studentId: string | null
  isActive: boolean
  joinedAt: Date
  lastSeenAt: Date | null
  lastLoginAt: Date | null
  online: boolean
}

/**
 * Membres d'une classe. La requete est TOUJOURS bornee par classGroupId :
 * un delegue ne peut pas obtenir les membres d'une autre classe, meme en
 * forgeant la requete.
 */
export async function listClassMembers(
  classGroupId: string,
  options: { q?: string; includeInactive?: boolean } = {},
): Promise<ClassMember[]> {
  const q = options.q?.trim()
  const where: Prisma.MembershipWhereInput = {
    classGroupId,
    ...(options.includeInactive ? {} : { isActive: true }),
    user: { deletedAt: null },
    // La recherche accepte le numero etudiant OU l'identite du compte.
    ...(q
      ? {
          OR: [
            { studentId: { contains: q, mode: 'insensitive' as const } },
            { user: { firstName: { contains: q, mode: 'insensitive' as const } } },
            { user: { lastName: { contains: q, mode: 'insensitive' as const } } },
            { user: { email: { contains: q, mode: 'insensitive' as const } } },
          ],
        }
      : {}),
  }

  const rows = await prisma.membership.findMany({
    where,
    select: {
      id: true,
      role: true,
      studentId: true,
      isActive: true,
      joinedAt: true,
      userId: true,
      user: {
        select: {
          firstName: true,
          lastName: true,
          email: true,
          avatarUrl: true,
          lastSeenAt: true,
          lastLoginAt: true,
        },
      },
    },
    orderBy: [{ role: 'asc' }, { user: { lastName: 'asc' } }],
    take: 500,
  })

  return rows.map((row) => ({
    membershipId: row.id,
    userId: row.userId,
    firstName: row.user.firstName,
    lastName: row.user.lastName,
    email: row.user.email,
    avatarUrl: row.user.avatarUrl ? `/api/users/${row.userId}/avatar` : null,
    role: row.role,
    studentId: row.studentId,
    isActive: row.isActive,
    joinedAt: row.joinedAt,
    lastSeenAt: row.user.lastSeenAt,
    lastLoginAt: row.user.lastLoginAt,
    online: isOnline(row.user.lastSeenAt),
  }))
}

/** Compteurs de membres et de presence pour l'espace d'administration. */
export async function classMemberStats(classGroupId: string) {
  const since = new Date(Date.now() - ONLINE_WINDOW_MS)
  const [total, admins, online] = await Promise.all([
    prisma.membership.count({
      where: { classGroupId, isActive: true, user: { deletedAt: null } },
    }),
    prisma.membership.count({
      where: { classGroupId, isActive: true, role: 'ADMIN', user: { deletedAt: null } },
    }),
    prisma.membership.count({
      where: {
        classGroupId,
        isActive: true,
        user: { deletedAt: null, lastSeenAt: { gte: since } },
      },
    }),
  ])
  return { total, admins, students: total - admins, online }
}

/** Nombre de delegues restants : sert a interdire le retrait du dernier. */
export async function countClassAdmins(classGroupId: string): Promise<number> {
  return prisma.membership.count({
    where: { classGroupId, role: 'ADMIN', isActive: true, user: { deletedAt: null } },
  })
}

/** Consommation de stockage d'une classe, en octets. */
export async function classStorage(classGroupId: string) {
  const row = await prisma.classGroup.findUnique({
    where: { id: classGroupId },
    select: { storageUsed: true, storageQuota: true },
  })
  return {
    used: Number(row?.storageUsed ?? 0),
    quota: Number(row?.storageQuota ?? 0),
  }
}
