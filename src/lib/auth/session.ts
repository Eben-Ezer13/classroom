import 'server-only'
import { cookies, headers } from 'next/headers'
import { createHash, randomBytes } from 'crypto'
import { cache } from 'react'
import { prisma } from '@/lib/db'
import {
  PRESENCE_REFRESH_MS,
  SESSION_COOKIE,
  SESSION_DURATION_DAYS,
} from '@/lib/constants'

/**
 * Sessions opaques persistees en base.
 *
 * Choix volontaire face au JWT auto-porteur : une session en base est
 * revocable immediatement (retrait d'une classe, changement de role,
 * desactivation d'un compte, deconnexion de tous les appareils). Le cookie
 * ne contient qu'un jeton aleatoire ; seule son empreinte SHA-256 est
 * stockee, donc une fuite de la base ne permet pas de rejouer une session.
 *
 * La session charge AUSSI toutes les appartenances de l'utilisateur. Les
 * autorisations sont ensuite decidees en memoire, sans requete
 * supplementaire : c'est ce qui rend le controle multi-tenant systematique
 * et peu couteux.
 */

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export type ClassRole = 'ADMIN' | 'MEMBER'
export type PlatformRole = 'ADMIN' | 'DELEGUE' | 'ETUDIANT'

/** Une classe a laquelle l'utilisateur appartient reellement. */
export type MembershipSummary = {
  classGroupId: string
  className: string
  classCode: string
  schoolName: string
  programName: string | null
  levelName: string | null
  role: ClassRole
  memberCount: number
}

export type SessionUser = {
  id: string
  email: string
  firstName: string
  lastName: string
  avatarUrl: string | null
  /** Role de plateforme : n'ouvre l'acces au contenu d'aucune classe. */
  platformRole: PlatformRole
  /** Classe actuellement affichee. Null si l'utilisateur n'a aucune classe. */
  classGroupId: string | null
  /** Role dans la classe active. 'MEMBER' par defaut, jamais eleve implicitement. */
  role: ClassRole
  className: string | null
  classCode: string | null
  schoolName: string | null
  programName: string | null
  levelName: string | null
  /** Numero etudiant dans la classe active. */
  studentId: string | null
  /** Toutes les classes de l'utilisateur, pour le selecteur d'espace. */
  memberships: MembershipSummary[]
}

async function requestMeta() {
  const h = await headers()
  const forwarded = h.get('x-forwarded-for')
  return {
    ip: forwarded ? forwarded.split(',')[0].trim() : null,
    userAgent: h.get('user-agent')?.slice(0, 255) ?? null,
  }
}

/** Cree une session et pose le cookie httpOnly. */
export async function createSession(userId: string): Promise<void> {
  const token = randomBytes(32).toString('base64url')
  const expiresAt = new Date(Date.now() + SESSION_DURATION_DAYS * 86_400_000)
  const meta = await requestMeta()

  await prisma.session.create({
    data: {
      tokenHash: hashToken(token),
      userId,
      expiresAt,
      ip: meta.ip,
      userAgent: meta.userAgent,
    },
  })

  const store = await cookies()
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    expires: expiresAt,
  })
}

/** Supprime la session courante cote base et cote navigateur. */
export async function destroySession(): Promise<void> {
  const store = await cookies()
  const token = store.get(SESSION_COOKIE)?.value
  if (token) {
    await prisma.session.deleteMany({ where: { tokenHash: hashToken(token) } })
  }
  store.delete(SESSION_COOKIE)
}

/** Revoque toutes les sessions d'un utilisateur (changement de mot de passe, retrait d'une classe). */
export async function revokeAllSessions(userId: string): Promise<void> {
  await prisma.session.deleteMany({ where: { userId } })
}

/**
 * Efface le cookie de session du navigateur. A appeler apres une revocation :
 * un cookie dont la session n'existe plus ne sert a rien et fausserait
 * l'aiguillage du middleware.
 */
export async function clearSessionCookie(): Promise<void> {
  const store = await cookies()
  store.delete(SESSION_COOKIE)
}

/**
 * Resout l'utilisateur de la requete courante.
 * `cache()` garantit une seule requete SQL par rendu, meme si dix composants
 * serveur appellent getCurrentUser().
 */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const store = await cookies()
  const token = store.get(SESSION_COOKIE)?.value
  if (!token) return null

  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    select: {
      id: true,
      expiresAt: true,
      user: {
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          avatarUrl: true,
          isActive: true,
          deletedAt: true,
          lastSeenAt: true,
          activeClassGroupId: true,
          memberships: {
            where: { isActive: true, classGroup: { deletedAt: null, isActive: true } },
            select: {
              classGroupId: true,
              role: true,
              studentId: true,
              classGroup: {
                select: {
                  name: true,
                  code: true,
                  schoolName: true,
                  programName: true,
                  levelName: true,
                  _count: { select: { memberships: { where: { isActive: true } } } },
                },
              },
            },
            orderBy: { joinedAt: 'asc' },
          },
        },
      },
    },
  })

  if (!session) return null

  // Session expiree : on la supprime au passage plutot que de laisser
  // s'accumuler des lignes mortes.
  if (session.expiresAt.getTime() < Date.now()) {
    await prisma.session.delete({ where: { id: session.id } }).catch(() => {})
    return null
  }

  const user = session.user
  // Un compte desactive ou supprime perd immediatement l'acces, meme si son
  // cookie est encore valide.
  if (!user.isActive || user.deletedAt) return null

  const memberships: MembershipSummary[] = user.memberships.map((m) => ({
    classGroupId: m.classGroupId,
    className: m.classGroup.name,
    classCode: m.classGroup.code,
    schoolName: m.classGroup.schoolName,
    programName: m.classGroup.programName,
    levelName: m.classGroup.levelName,
    role: m.role,
    memberCount: m.classGroup._count.memberships,
  }))

  // La classe active doit correspondre a une appartenance REELLE. Si la
  // preference pointe vers une classe quittee, on retombe sur la premiere
  // classe disponible : la preference ne donne jamais d'acces par elle-meme.
  const active =
    memberships.find((m) => m.classGroupId === user.activeClassGroupId) ??
    memberships[0] ??
    null

  if (active && active.classGroupId !== user.activeClassGroupId) {
    await prisma.user
      .update({
        where: { id: user.id },
        data: { activeClassGroupId: active.classGroupId },
      })
      .catch(() => {})
  }

  // Presence : une ecriture au maximum toutes les quelques minutes, pas une
  // par requete. Suffisant pour un indicateur "en ligne" et negligeable
  // pour la base.
  const stale =
    !user.lastSeenAt || Date.now() - user.lastSeenAt.getTime() > PRESENCE_REFRESH_MS
  if (stale) {
    await prisma.user
      .update({ where: { id: user.id }, data: { lastSeenAt: new Date() } })
      .catch(() => {})
  }

  const activeMembership = active
    ? user.memberships.find((m) => m.classGroupId === active.classGroupId)
    : undefined

  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    // Le chemin de stockage n est jamais expose : on renvoie l URL de la
    // route protegee qui sert l image.
    avatarUrl: user.avatarUrl ? `/api/users/${user.id}/avatar` : null,
    platformRole: user.role,
    classGroupId: active?.classGroupId ?? null,
    role: active?.role ?? 'MEMBER',
    className: active?.className ?? null,
    classCode: active?.classCode ?? null,
    schoolName: active?.schoolName ?? null,
    programName: active?.programName ?? null,
    levelName: active?.levelName ?? null,
    studentId: activeMembership?.studentId ?? null,
    memberships,
  }
})

/** Nettoyage des sessions expirees (appele apres une connexion). */
export async function pruneExpiredSessions(): Promise<void> {
  await prisma.session
    .deleteMany({ where: { expiresAt: { lt: new Date() } } })
    .catch(() => {})
}
