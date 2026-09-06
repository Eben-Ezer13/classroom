import 'server-only'
import { prisma } from '@/lib/db'
import { ForbiddenError, NotFoundError } from '@/lib/errors'
import type { MembershipSummary, SessionUser } from '@/lib/auth/session'

/**
 * Isolation multi-tenant.
 *
 * Regle unique : une donnee appartient a une classe, et un utilisateur ne
 * voit que les classes dont il est membre. Les appartenances sont deja
 * chargees dans la session, donc chaque verification est faite en memoire,
 * sans requete supplementaire.
 *
 * Deux consequences appliquees partout :
 *   - un classGroupId envoye par le navigateur n'est jamais utilise tel
 *     quel : il doit correspondre a une appartenance reelle ;
 *   - un acces par identifiant (ressource, annonce, seance...) filtre
 *     TOUJOURS aussi sur la classe, donc changer un id dans une URL ne
 *     donne acces a rien (pas d'IDOR).
 */

/** Appartenance de l'utilisateur a cette classe, si elle existe. */
export function membershipOf(
  user: SessionUser,
  classGroupId: string | null | undefined,
): MembershipSummary | undefined {
  if (!classGroupId) return undefined
  return user.memberships.find((m) => m.classGroupId === classGroupId)
}

/** L'utilisateur peut-il consulter le contenu de cette classe ? */
export function canViewClass(user: SessionUser, classGroupId: string): boolean {
  return membershipOf(user, classGroupId) !== undefined
}

/** L'utilisateur peut-il publier / modifier du contenu dans cette classe ? */
export function canManageClass(user: SessionUser, classGroupId: string): boolean {
  return membershipOf(user, classGroupId)?.role === 'ADMIN'
}

/** 404 plutot que 403 : on ne revele pas l'existence du contenu d'autrui. */
export function assertCanViewClass(user: SessionUser, classGroupId: string): void {
  if (!canViewClass(user, classGroupId)) throw new NotFoundError()
}

export function assertCanManageClass(user: SessionUser, classGroupId: string): void {
  if (!canViewClass(user, classGroupId)) throw new NotFoundError()
  if (!canManageClass(user, classGroupId)) {
    throw new ForbiddenError('Action reservee au delegue de la classe.')
  }
}

/**
 * Classe de travail d'une ecriture.
 *
 * Un identifiant peut etre transmis par le formulaire (utile quand un
 * utilisateur appartient a plusieurs classes), mais il n'est accepte que
 * s'il correspond a une appartenance. Sinon on retombe sur la classe
 * active ; sans classe du tout, l'action est refusee.
 */
export function requireClassId(user: SessionUser, requested?: string | null): string {
  if (requested && requested !== user.classGroupId) {
    if (!canViewClass(user, requested)) {
      throw new NotFoundError('Classe introuvable.')
    }
    return requested
  }
  if (!user.classGroupId) {
    throw new ForbiddenError("Votre compte n'est rattache a aucune classe.")
  }
  return user.classGroupId
}

/** Idem, mais l'utilisateur doit etre delegue de la classe visee. */
export function requireManagedClassId(
  user: SessionUser,
  requested?: string | null,
): string {
  const classGroupId = requireClassId(user, requested)
  assertCanManageClass(user, classGroupId)
  return classGroupId
}

/**
 * Filtre Prisma a appliquer sur toute entite portant un classGroupId.
 * Un utilisateur sans classe obtient un filtre qui ne remonte aucune ligne :
 * jamais un filtre vide, qui exposerait toute la table.
 */
export function classScopeFilter(user: SessionUser, requested?: string | null) {
  const classGroupId = requested && canViewClass(user, requested)
    ? requested
    : user.classGroupId
  return { classGroupId: classGroupId ?? '__aucune_classe__' }
}

/** Filtre couvrant toutes les classes de l'utilisateur (vues transversales). */
export function allClassesFilter(user: SessionUser) {
  const ids = user.memberships.map((m) => m.classGroupId)
  return { classGroupId: { in: ids.length > 0 ? ids : ['__aucune_classe__'] } }
}

/**
 * Semestre courant de la classe. Sert de valeur par defaut a la creation de
 * contenu. La recherche reste bornee a la classe : jamais de repli sur le
 * semestre d'une autre classe.
 */
export async function resolveCurrentSemesterId(
  classGroupId: string,
): Promise<string | null> {
  const current = await prisma.semester.findFirst({
    where: {
      isArchived: false,
      academicYear: { classGroupId },
    },
    orderBy: [{ isCurrent: 'desc' }, { startsAt: 'desc' }],
    select: { id: true },
  })
  if (current) return current.id

  const any = await prisma.semester.findFirst({
    where: { academicYear: { classGroupId } },
    orderBy: { startsAt: 'desc' },
    select: { id: true },
  })
  return any?.id ?? null
}

/** Verifie qu'un module appartient bien a la classe avant toute ecriture. */
export async function assertModuleInClass(
  moduleId: string | null | undefined,
  classGroupId: string,
): Promise<void> {
  if (!moduleId) return
  const found = await prisma.module.findFirst({
    where: { id: moduleId, classGroupId, deletedAt: null },
    select: { id: true },
  })
  if (!found) throw new NotFoundError('Module introuvable dans cette classe.')
}

/**
 * Verifie qu'un semestre appartient a la classe.
 * Indispensable : sans ce controle, un delegue pourrait rattacher son
 * contenu au calendrier d'une autre classe.
 */
export async function assertSemesterInClass(
  semesterId: string,
  classGroupId: string,
): Promise<void> {
  const found = await prisma.semester.findFirst({
    where: { id: semesterId, academicYear: { classGroupId } },
    select: { id: true },
  })
  if (!found) throw new NotFoundError('Semestre introuvable dans cette classe.')
}

/** Verifie qu'un projet appartient a la classe. */
export async function assertProjectInClass(
  projectId: string | null | undefined,
  classGroupId: string,
): Promise<void> {
  if (!projectId) return
  const found = await prisma.project.findFirst({
    where: { id: projectId, classGroupId, deletedAt: null },
    select: { id: true },
  })
  if (!found) throw new NotFoundError('Projet introuvable dans cette classe.')
}
