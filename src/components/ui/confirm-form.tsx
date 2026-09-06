'use client'

import type { ReactNode } from 'react'
import { useFormStatus } from 'react-dom'
import { cn } from '@/lib/utils'
import { Spinner } from './submit-button'

/**
 * Formulaire de suppression avec confirmation navigateur.
 * `onSubmit` bloque l'envoi si l'utilisateur annule : la confirmation est
 * donc reellement bloquante, contrairement a un simple onClick.
 */
export function ConfirmForm({
  action,
  message,
  children,
  className,
  hidden,
}: {
  action: (formData: FormData) => Promise<void>
  message: string
  children?: ReactNode
  className?: string
  hidden?: Record<string, string>
}) {
  return (
    <form
      action={action}
      className={className}
      onSubmit={(e) => {
        if (!window.confirm(message)) e.preventDefault()
      }}
    >
      {Object.entries(hidden ?? {}).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      {children}
    </form>
  )
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
