'use client'

import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

/**
 * Messages ephemeres ("Ressource supprimee", "Vous etes le seul delegue...").
 *
 * Indispensable pour les actions sans formulaire a etat (suppression,
 * changement de role...) : en production, Next.js masque le message des
 * erreurs levees par une Server Action. Ces actions renvoient donc leur
 * message, que ActionForm affiche ici. Aucune dependance : un evenement
 * navigateur suffit.
 */

type ToastTone = 'success' | 'danger' | 'info'
type ToastItem = { id: number; tone: ToastTone; message: string }

const TOAST_EVENT = 'app:toast'

export function notify(message: string, tone: ToastTone = 'info'): void {
  window.dispatchEvent(new CustomEvent(TOAST_EVENT, { detail: { message, tone } }))
}

const TONES: Record<ToastTone, string> = {
  success: 'border-[var(--success-border)] text-[var(--success-strong)]',
  danger: 'border-[var(--danger-border)] text-[var(--danger-strong)]',
  info: 'border-[var(--border-strong)] text-[var(--text-1)]',
}

const DOTS: Record<ToastTone, string> = {
  success: 'bg-[var(--success)]',
  danger: 'bg-[var(--danger)]',
  info: 'bg-[var(--info)]',
}

let nextId = 0

export function Toaster() {
  const [items, setItems] = useState<ToastItem[]>([])

  useEffect(() => {
    const onToast = (event: Event) => {
      const detail = (event as CustomEvent<{ message: string; tone: ToastTone }>).detail
      if (!detail?.message) return
      nextId += 1
      const id = nextId
      // Trois messages au plus a l'ecran : les plus anciens cedent la place.
      setItems((current) => [...current.slice(-2), { id, ...detail }])
      window.setTimeout(
        () => setItems((current) => current.filter((item) => item.id !== id)),
        detail.tone === 'danger' ? 8000 : 4000,
      )
    }
    window.addEventListener(TOAST_EVENT, onToast)
    return () => window.removeEventListener(TOAST_EVENT, onToast)
  }, [])

  const dismiss = (id: number) => setItems((current) => current.filter((item) => item.id !== id))

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-3 bottom-20 z-[60] space-y-2 sm:inset-x-auto sm:right-6 sm:w-[380px] lg:bottom-6"
    >
      {items.map((item) => (
        <div
          key={item.id}
          role={item.tone === 'danger' ? 'alert' : 'status'}
          className={cn(
            'pointer-events-auto flex items-start gap-3 rounded-xl border bg-[var(--surface-1)] px-4 py-3 text-[13px] leading-relaxed shadow-[var(--shadow-lg)] animate-fade-up',
            TONES[item.tone],
          )}
        >
          <span className={cn('mt-1.5 size-2 shrink-0 rounded-full', DOTS[item.tone])} />
          <p className="flex-1">{item.message}</p>
          <button
            type="button"
            onClick={() => dismiss(item.id)}
            aria-label="Fermer le message"
            className="-mr-1 shrink-0 rounded-md px-1 text-[var(--text-3)] hover:text-[var(--text-1)]"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  )
}
