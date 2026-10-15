'use client'

import { useState, type ComponentProps } from 'react'
import { cn } from '@/lib/utils'

const CONTROL =
  'w-full rounded-lg border border-[var(--border-strong)] bg-[var(--surface-1)] px-3 text-sm ' +
  'text-[var(--text-1)] placeholder:text-[var(--text-3)] transition-colors ' +
  'focus:border-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/20 ' +
  'disabled:opacity-60 disabled:bg-[var(--surface-3)]'

export function PasswordInput({ className, ...props }: Omit<ComponentProps<'input'>, 'type'>) {
  const [visible, setVisible] = useState(false)
  return (
    <div className="relative">
      <input
        {...props}
        type={visible ? 'text' : 'password'}
        className={cn(CONTROL, 'h-10 pr-11', className)}
      />
      <button
        type="button"
        onClick={() => setVisible((current) => !current)}
        aria-label={visible ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
        aria-pressed={visible}
        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-2 text-[var(--text-3)] hover:bg-[var(--surface-3)] hover:text-[var(--text-1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
      >
        {visible ? (
          <svg viewBox="0 0 24 24" className="size-[18px]" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M3 3l18 18M10.6 10.6a2 2 0 002.8 2.8" />
            <path d="M9.9 5.2A10.8 10.8 0 0112 5c5 0 8.5 4.4 9.5 6.5a1 1 0 010 1 15 15 0 01-3.3 4.1M6.2 6.2A15 15 0 002.5 11.5a1 1 0 000 1C3.5 14.6 7 19 12 19c1.2 0 2.3-.3 3.3-.8" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" className="size-[18px]" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
            <circle cx="12" cy="12" r="2.5" />
          </svg>
        )}
      </button>
    </div>
  )
}
