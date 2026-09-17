'use client'

import { useActionState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { emptyActionState, type ActionState } from '@/lib/errors'
import { notify } from './toast'

/**
 * Rafraichit la page une fois une action reussie TERMINEE.
 *
 * Les Server Actions n'appellent pas revalidatePath : en production, une
 * action dont la reponse embarque l'arbre de la page (ce que declenche
 * revalidatePath) laissait regulierement le formulaire bloque sur
 * "Enregistrement..." alors que la donnee etait enregistree (transition
 * React jamais validee, environ une soumission sur trois). Le
 * rafraichissement est donc demande apres coup, hors de la transition de
 * l'action. Les pages de l'application etant dynamiques, les autres pages
 * sont de toute facon relues a chaque navigation.
 */
export function useRefreshOnSuccess(state: ActionState | null | undefined) {
  const router = useRouter()
  useEffect(() => {
    if (state?.ok) router.refresh()
  }, [state, router])
}

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

  useRefreshOnSuccess(state)

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

/**
 * Formulaire en modale : ferme la modale apres un succes et reprend le
 * message du serveur ("Annonce publiée", avertissement de chevauchement...)
 * dans une notification, sans quoi il disparaitrait avec la modale.
 */
export function useCloseOnSuccess(state: ActionState, onDone?: () => void) {
  useEffect(() => {
    if (!state.ok) return
    if (state.message) notify(state.message, 'success')
    onDone?.()
  }, [state, onDone])
}
