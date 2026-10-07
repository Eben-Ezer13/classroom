import { isRedirectError } from 'next/dist/client/components/redirect-error'

/**
 * Erreurs applicatives et forme standard des retours de Server Actions.
 */

export class AppError extends Error {
  constructor(message: string, readonly status: number = 400) {
    super(message)
    this.name = 'AppError'
  }
}

/** 401 - non authentifie. */
export class UnauthorizedError extends AppError {
  constructor(message = 'Vous devez être connecté.') {
    super(message, 401)
    this.name = 'UnauthorizedError'
  }
}

/** 403 - authentifie mais pas autorise. */
export class ForbiddenError extends AppError {
  constructor(message = "Vous n'avez pas l'autorisation d'effectuer cette action.") {
    super(message, 403)
    this.name = 'ForbiddenError'
  }
}

/** 404 - ressource inexistante ou hors du perimetre de l'utilisateur. */
export class NotFoundError extends AppError {
  constructor(message = 'Élément introuvable.') {
    super(message, 404)
    this.name = 'NotFoundError'
  }
}

/** Etat renvoye par toutes les Server Actions liees a un formulaire. */
export type ActionState = {
  ok: boolean
  message?: string
  fieldErrors?: Record<string, string[]>
}

function unexpectedActionMessage(error: unknown): string {
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? (error as { code?: unknown }).code
      : undefined
  if (code === 'P2021' || code === 'P2022') {
    return 'La base de données doit encore être mise à jour. Attendez la fin du déploiement Vercel puis réessayez.'
  }
  if (code === 'P1001' || code === 'P1002' || code === 'P1008') {
    return 'La base de données est momentanément indisponible. Réessayez dans quelques instants.'
  }
  const message = error instanceof Error ? error.message : ''
  if (/vercel blob|blob.*access|access.*blob/i.test(message)) {
    return 'Vercel Blob refuse l’accès au stockage. Vérifiez le jeton et le mode public du store.'
  }
  return 'Une erreur inattendue est survenue.'
}

export const emptyActionState: ActionState = { ok: false }

/**
 * Enveloppe une Server Action : convertit les exceptions connues en message
 * utilisateur et evite qu'une stack trace ne fuite vers le client.
 */
export async function runAction(fn: () => Promise<ActionState>): Promise<ActionState> {
  try {
    return await fn()
  } catch (error) {
    // Les redirections Next.js sont propagees telles quelles.
    if (isRedirectError(error)) {
      throw error
    }
    if (error instanceof AppError) {
      return { ok: false, message: error.message }
    }
    console.error('[action]', error)
    return { ok: false, message: unexpectedActionMessage(error) }
  }
}
