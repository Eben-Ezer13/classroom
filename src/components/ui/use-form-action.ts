'use client'

import { useActionState } from 'react'
import { emptyActionState, type ActionState } from '@/lib/errors'

/**
 * Etat d'un formulaire soumis a une Server Action.
 *
 * Apres chaque soumission, React 19 reinitialise les champs non controles.
 * Sans precaution, un refus ("mot de passe trop court") effacait donc TOUT
 * ce que l'utilisateur avait saisi. Les valeurs envoyees sont renvoyees avec
 * l'erreur et servent de valeurs par defaut : la reinitialisation les
 * restitue au lieu de vider le formulaire.
 */
export type FormState = ActionState & {
  /** Valeurs soumises (hors mots de passe), restituees apres un refus. */
  values?: Record<string, string[]>
}

/** Jamais restitues : un mot de passe refuse doit etre ressaisi. */
const SECRET_FIELD = /password/i

function submittedValues(formData: FormData): Record<string, string[]> {
  const values: Record<string, string[]> = {}
  for (const [key, value] of formData.entries()) {
    if (typeof value !== 'string' || key.startsWith('$') || SECRET_FIELD.test(key)) continue
    ;(values[key] ??= []).push(value)
  }
  return values
}

type Action = (previous: ActionState, formData: FormData) => Promise<ActionState>

export function useFormAction(action: Action) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    async (previous, formData) => {
      const result = await action(previous, formData)
      return result.ok ? result : { ...result, values: submittedValues(formData) }
    },
    emptyActionState,
  )

  const values = state.values

  return {
    state,
    formAction,
    pending,
    /** Valeur d'un champ texte : la saisie refusee, sinon la valeur initiale. */
    value(name: string, initial?: string | number | null): string {
      return values ? (values[name]?.[0] ?? '') : initial == null ? '' : String(initial)
    },
    /** Case a cocher : l'etat soumis, sinon l'etat initial. */
    checked(name: string, initial = false): boolean {
      return values ? name in values : initial
    },
    /** Champ repete (options de sondage, mentions...). */
    list(name: string, initial: string[] = []): string[] {
      return values ? (values[name] ?? []) : initial
    },
  }
}
