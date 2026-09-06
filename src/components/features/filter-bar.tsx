import Link from 'next/link'
import type { ReactNode } from 'react'
import { Card } from '@/components/ui/card'
import { buttonClasses } from '@/components/ui/button'
import { IconFilter } from '@/components/ui/icons'

/**
 * Barre de filtres en formulaire GET : l'etat vit dans l'URL.
 * Consequence utile : les filtres sont partageables, revenir en arriere
 * fonctionne, et la page reste utilisable sans JavaScript.
 */
export function FilterBar({
  action,
  children,
  hasFilters,
}: {
  action: string
  children: ReactNode
  hasFilters: boolean
}) {
  return (
    <Card className="mb-4">
      <form method="get" action={action} className="p-3.5">
        <div className="flex flex-wrap items-end gap-2.5">
          {children}
          <div className="flex items-center gap-2 ml-auto">
            {hasFilters ? (
              <Link href={action} className={buttonClasses('ghost', 'sm')}>
                Reinitialiser
              </Link>
            ) : null}
            <button type="submit" className={buttonClasses('secondary', 'sm')}>
              <IconFilter className="size-4" />
              Filtrer
            </button>
          </div>
        </div>
      </form>
    </Card>
  )
}

export function FilterField({
  label,
  htmlFor,
  children,
  className = 'min-w-[150px] flex-1',
}: {
  label: string
  htmlFor: string
  children: ReactNode
  className?: string
}) {
  return (
    <div className={className}>
      <label
        htmlFor={htmlFor}
        className="block mb-1 text-[11.5px] font-medium uppercase tracking-wide text-[var(--text-3)]"
      >
        {label}
      </label>
      {children}
    </div>
  )
}
