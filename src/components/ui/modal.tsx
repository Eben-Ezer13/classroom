'use client'

import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { buttonClasses } from './button'
import { cn } from '@/lib/utils'

/**
 * Modale accessible sans dependance externe :
 * fermeture par Echap et par clic sur le fond, focus place a l'ouverture,
 * defilement de la page bloque tant qu'elle est ouverte.
 */
export function Modal({
  trigger,
  triggerVariant = 'primary',
  triggerSize = 'md',
  triggerClassName,
  triggerLabel,
  title,
  description,
  children,
  width = 'md',
  defaultOpen = false,
}: {
  trigger: ReactNode
  triggerVariant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'subtle'
  triggerSize?: 'sm' | 'md' | 'lg' | 'icon'
  triggerClassName?: string
  /**
   * Nom accessible du bouton. Obligatoire en pratique pour un bouton-icone :
   * sans lui, un lecteur d'ecran annonce seulement "bouton". Par defaut, le
   * titre de la modale.
   */
  triggerLabel?: string
  title: string
  description?: string
  children: ReactNode | ((close: () => void) => ReactNode)
  width?: 'sm' | 'md' | 'lg'
  /** Ouvre la modale des le premier rendu (lien "?nouveau=1"). */
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  const panelRef = useRef<HTMLDivElement>(null)
  const titleId = useId()

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    panelRef.current?.querySelector<HTMLElement>(
      'input, textarea, select, button',
    )?.focus()
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = previousOverflow
    }
  }, [open])

  const widths = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl' }
  const close = () => setOpen(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-label={triggerSize === 'icon' ? (triggerLabel ?? title) : triggerLabel}
        title={triggerSize === 'icon' ? (triggerLabel ?? title) : undefined}
        className={buttonClasses(triggerVariant, triggerSize, triggerClassName)}
      >
        {trigger}
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
        >
          <div
            className="absolute inset-0 bg-black/45 backdrop-blur-[2px] animate-fade-in"
            onClick={close}
            aria-hidden="true"
          />
          <div
            ref={panelRef}
            className={cn(
              'relative w-full bg-[var(--surface-1)] border border-[var(--border)] shadow-[var(--shadow-lg)]',
              'rounded-t-2xl sm:rounded-2xl max-h-[92dvh] overflow-y-auto animate-scale-in',
              widths[width],
            )}
          >
            <div className="flex items-start justify-between gap-4 px-5 py-4 border-b border-[var(--border)] sticky top-0 bg-[var(--surface-1)] rounded-t-2xl z-10">
              <div className="min-w-0">
                <h2 id={titleId} className="text-[15px] font-semibold text-[var(--text-1)]">
                  {title}
                </h2>
                {description ? (
                  <p className="text-[13px] text-[var(--text-3)] mt-0.5">{description}</p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={close}
                aria-label="Fermer"
                className="shrink-0 size-8 grid place-items-center rounded-lg text-[var(--text-3)] hover:bg-[var(--surface-3)] hover:text-[var(--text-1)] transition-colors"
              >
                <svg viewBox="0 0 20 20" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M5 5l10 10M15 5L5 15" strokeLinecap="round" />
                </svg>
              </button>
            </div>
            <div className="p-5">
              {typeof children === 'function' ? children(close) : children}
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
