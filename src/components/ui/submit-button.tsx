'use client'

import { useFormStatus } from 'react-dom'
import { Button } from './button'
import type { ComponentProps } from 'react'

type Props = Omit<ComponentProps<typeof Button>, 'type'> & {
  pendingLabel?: string
}

/**
 * Bouton de soumission lie a l'etat du formulaire parent.
 * Se desactive pendant l'envoi : empeche les doubles soumissions
 * (double creation de ressource, double vote, etc.).
 */
export function SubmitButton({ children, pendingLabel, disabled, ...props }: Props) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending || disabled} {...props}>
      {pending ? (
        <>
          <Spinner />
          {pendingLabel ?? 'Envoi...'}
        </>
      ) : (
        children
      )}
    </Button>
  )
}

export function Spinner({ className = 'size-3.5' }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.25" />
      <path
        d="M22 12a10 10 0 0 0-10-10"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  )
}
