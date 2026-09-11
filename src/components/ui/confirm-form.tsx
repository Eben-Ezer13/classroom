'use client'

import type { ReactNode } from 'react'
import { useFormStatus } from 'react-dom'
import type { ActionState } from '@/lib/errors'
import { cn } from '@/lib/utils'
import { Spinner } from './submit-button'
import { notify } from './toast'

type FormAction = (formData: FormData) => Promise<ActionState | void>

/**
 * Formulaire d'action ponctuelle (supprimer, archiver, changer un role...).
 *
 * L'action renvoie son resultat au lieu de lever une erreur : en production,
 * Next.js masque le message des erreurs de Server Action, et l'utilisateur
 * ne verrait qu'une page d'erreur generique. Le message est affiche dans une
 * notification ephemere.
 */
export function ActionForm({
  action,
  confirm,
  children,
  className,
  hidden,
}: {
  action: FormAction
  /** Question de confirmation ; l'envoi est annule si l'utilisateur refuse. */
  confirm?: string
  children?: ReactNode
  className?: string
  hidden?: Record<string, string>
}) {
  return (
    <form
      className={className}
      action={async (formData) => {
        const result = await action(formData)
        if (!result?.message) return
        notify(result.message, result.ok ? 'success' : 'danger')
      }}
      onSubmit={
        confirm
          ? (event) => {
              // Bloquant : un simple onClick n'empecherait pas l'envoi.
              if (!window.confirm(confirm)) event.preventDefault()
            }
          : undefined
      }
    >
      {Object.entries(hidden ?? {}).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      {children}
    </form>
  )
}

/** Formulaire de suppression avec confirmation navigateur. */
export function ConfirmForm({
  message,
  ...props
}: Omit<Parameters<typeof ActionForm>[0], 'confirm'> & { message: string }) {
  return <ActionForm {...props} confirm={message} />
}

export function IconSubmit({
  label,
  tone = 'neutral',
  children,
}: {
  label: string
  tone?: 'neutral' | 'danger'
  children: ReactNode
}) {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      title={label}
      aria-label={label}
      className={cn(
        'size-8 grid place-items-center rounded-lg transition-colors disabled:opacity-50',
        tone === 'danger'
          ? 'text-[var(--text-3)] hover:bg-[var(--danger-soft)] hover:text-[var(--danger)]'
          : 'text-[var(--text-3)] hover:bg-[var(--surface-3)] hover:text-[var(--text-1)]',
      )}
    >
      {pending ? <Spinner /> : children}
    </button>
  )
}
