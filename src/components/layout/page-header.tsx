import type { ReactNode } from 'react'
import Link from 'next/link'
import { IconChevronRight } from '@/components/ui/icons'

export function PageHeader({
  title,
  description,
  actions,
  breadcrumb,
}: {
  title: string
  description?: string
  actions?: ReactNode
  breadcrumb?: Array<{ label: string; href?: string }>
}) {
  return (
    <div className="mb-5">
      {breadcrumb && breadcrumb.length > 0 ? (
        <nav aria-label="Fil d'Ariane" className="mb-2">
          <ol className="flex items-center gap-1 text-[12.5px] text-[var(--text-3)] flex-wrap">
            {breadcrumb.map((crumb, i) => (
              <li key={`${crumb.label}-${i}`} className="flex items-center gap-1">
                {i > 0 ? <IconChevronRight className="size-3.5 opacity-60" /> : null}
                {crumb.href ? (
                  <Link href={crumb.href} className="hover:text-[var(--text-1)] transition-colors">
                    {crumb.label}
                  </Link>
                ) : (
                  <span className="text-[var(--text-2)]">{crumb.label}</span>
                )}
              </li>
            ))}
          </ol>
        </nav>
      ) : null}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-[21px] sm:text-[24px] font-semibold tracking-[-0.015em] text-[var(--text-1)]">
            {title}
          </h1>
          {description ? (
            <p className="text-[13.5px] text-[var(--text-3)] mt-1 leading-relaxed">
              {description}
            </p>
          ) : null}
        </div>
        {actions ? <div className="flex items-center gap-2 shrink-0">{actions}</div> : null}
      </div>
    </div>
  )
}
