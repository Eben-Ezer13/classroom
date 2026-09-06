'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { IconWarning } from '@/components/ui/icons'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[app]', error)
  }, [error])

  return (
    <div className="min-h-dvh grid place-items-center px-4">
      <div className="text-center max-w-md">
        <span className="inline-grid place-items-center size-12 rounded-2xl bg-[var(--danger-soft)] text-[var(--danger)]">
          <IconWarning className="size-5" />
        </span>
        <h1 className="mt-4 text-[22px] font-semibold tracking-[-0.02em] text-[var(--text-1)]">
          Une erreur est survenue
        </h1>
        <p className="mt-2 text-[14px] text-[var(--text-2)] leading-relaxed">
          L’opération n’a pas pu aboutir. Réessayez ; si le problème persiste,
          signalez-le à votre administrateur.
        </p>
        {error.digest ? (
          <p className="mt-2 text-[12px] text-[var(--text-3)] font-mono">
            Référence : {error.digest}
          </p>
        ) : null}
        <Button onClick={reset} className="mt-6">
          Réessayer
        </Button>
      </div>
    </div>
  )
}
