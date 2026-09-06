import Link from 'next/link'
import { cn } from '@/lib/utils'

/**
 * Pagination par liens : reste fonctionnelle sans JavaScript et conserve
 * tous les filtres actifs dans l'URL.
 */
export function Pagination({
  page,
  pageCount,
  total,
  basePath,
  params,
}: {
  page: number
  pageCount: number
  total: number
  basePath: string
  params?: Record<string, string | undefined>
}) {
  if (pageCount <= 1) {
    return total > 0 ? (
      <p className="px-5 py-3 text-[12.5px] text-[var(--text-3)] border-t border-[var(--border)]">
        {total} resultat{total > 1 ? 's' : ''}
      </p>
    ) : null
  }

  const href = (target: number) => {
    const search = new URLSearchParams()
    for (const [key, value] of Object.entries(params ?? {})) {
      if (value) search.set(key, value)
    }
    search.set('page', String(target))
    return `${basePath}?${search.toString()}`
  }

  const pages: number[] = []
  const from = Math.max(1, page - 2)
  const to = Math.min(pageCount, from + 4)
  for (let i = Math.max(1, to - 4); i <= to; i++) pages.push(i)

  const linkClass =
    'inline-flex items-center justify-center h-8 min-w-8 px-2 rounded-md text-[13px] border transition-colors'

  return (
    <nav
      aria-label="Pagination"
      className="flex items-center justify-between gap-3 px-5 py-3 border-t border-[var(--border)] flex-wrap"
    >
      <p className="text-[12.5px] text-[var(--text-3)]">
        {total} resultat{total > 1 ? 's' : ''} &middot; page {page} sur {pageCount}
      </p>
      <div className="flex items-center gap-1.5">
        {page > 1 ? (
          <Link
            href={href(page - 1)}
            className={cn(
              linkClass,
              'border-[var(--border-strong)] text-[var(--text-2)] hover:bg-[var(--surface-3)]',
            )}
          >
            Precedent
          </Link>
        ) : null}
        {pages.map((p) => (
          <Link
            key={p}
            href={href(p)}
            aria-current={p === page ? 'page' : undefined}
            className={cn(
              linkClass,
              p === page
                ? 'bg-[var(--accent)] text-[var(--accent-contrast)] border-[var(--accent)] font-medium'
                : 'border-[var(--border-strong)] text-[var(--text-2)] hover:bg-[var(--surface-3)]',
            )}
          >
            {p}
          </Link>
        ))}
        {page < pageCount ? (
          <Link
            href={href(page + 1)}
            className={cn(
              linkClass,
              'border-[var(--border-strong)] text-[var(--text-2)] hover:bg-[var(--surface-3)]',
            )}
          >
            Suivant
          </Link>
        ) : null}
      </div>
    </nav>
  )
}
