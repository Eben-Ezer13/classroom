import 'server-only'
import { redirect } from 'next/navigation'
import { getCurrentUser, type SessionUser } from '@/lib/auth/session'
import { ForbiddenError, UnauthorizedError } from '@/lib/errors'

export type { ClassRole, PlatformRole, SessionUser } from '@/lib/auth/session'

/**
 * Gardes d'acces.
 *
 * Deux niveaux, jamais melanges :
 *   1. authentification  -> requireUser / requirePageUser ;
 *   2. appartenance a la classe active -> requireClassContext /
 *      requireClassAdmin.
 *
 * Aucun role de plateforme n'ouvre l'acces au contenu d'une classe : seul
 * un Membership le fait.
 */

/**
 * Garde pour les pages (Server Components) : redirige vers la connexion.
 * A n'utiliser que dans un contexte de rendu de page.
 */
export async function requirePageUser(): Promise<SessionUser> {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  return user
}

/**
 * Garde pour les Server Actions et route handlers : leve une erreur au lieu
 * de rediriger, pour que l'appelant renvoie un message exploitable.
 */
export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser()
  if (!user) throw new UnauthorizedError()
  return user
}

export type ClassContext = {
  user: SessionUser
  /** Classe active, garantie appartenir a l'utilisateur. */
  classId: string
  isAdmin: boolean
}

/**
 * Contexte de travail : l'utilisateur ET sa classe active.
 * Toute action metier passe par ici : le classId retourne vient de la
 * session, jamais du formulaire.
 */
export async function requireClassContext(): Promise<ClassContext> {
  const user = await requireUser()
  if (!user.classGroupId) {
    throw new ForbiddenError(
      "Vous n'appartenez a aucune classe. Creez votre classe ou rejoignez-en une avec un code d'invitation.",
    )
  }
  return { user, classId: user.classGroupId, isAdmin: user.role === 'ADMIN' }
}

/** Reserve aux delegues (ADMIN) de la classe active. */
export async function requireClassAdmin(): Promise<ClassContext> {
  const context = await requireClassContext()
  if (!context.isAdmin) {
    throw new ForbiddenError(
      'Action reservee au delegue de la classe.',
    )
  }
  return context
}

/** Variante page : renvoie vers l'ecran des classes si aucune classe active. */
export async function requirePageClassContext(): Promise<ClassContext> {
  const user = await requirePageUser()
  if (!user.classGroupId) redirect('/classes')
  return { user, classId: user.classGroupId, isAdmin: user.role === 'ADMIN' }
}

/** Variante page reservee au delegue : renvoie au tableau de bord sinon. */
export async function requirePageClassAdmin(): Promise<ClassContext> {
  const context = await requirePageClassContext()
  if (!context.isAdmin) redirect('/dashboard')
  return context
}

/** Delegue de la classe active. */
export function isClassAdmin(user: SessionUser): boolean {
  return user.role === 'ADMIN' && user.classGroupId !== null
}
