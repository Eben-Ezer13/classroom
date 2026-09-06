/**
 * Erreurs applicatives et forme standard des retours de Server Actions.
 */

export class AppError extends Error {
  constructor(
    message: string,
    readonly status: number = 400,
  ) {
    super(message)
    this.name = 'AppError'
  }
}

/** 401 - non authentifie. */
export class UnauthorizedError extends AppError {
  constructor(message = 'Vous devez etre connecte.') {
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
  constructor(message = 'Element introuvable.') {
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
    if (
      error &&
      typeof error === 'object' &&
      'digest' in error &&
      typeof (error as { digest?: unknown }).digest === 'string' &&
      ((error as { digest: string }).digest.startsWith('NEXT_REDIRECT') ||
        (error as { digest: string }).digest === 'NEXT_NOT_FOUND')
    ) {
      throw error
    }
    if (error instanceof AppError) {
      return { ok: false, message: error.message }
    }
    console.error('[action]', error)
    return { ok: false, message: 'Une erreur inattendue est survenue.' }
  }
}
