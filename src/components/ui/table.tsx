import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * Tableau responsive : le conteneur defile horizontalement plutot que de
 * faire deborder la page sur mobile.
 */
export function Table({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className="w-full overflow-x-auto">
      <table className={cn('w-full text-sm border-collapse min-w-[560px]', className)}>
        {children}
      </table>
    </div>
  )
}

export function THead({ children }: { children: ReactNode }) {
  return (
    <thead className="bg-[var(--surface-2)]">
      <tr>{children}</tr>
    </thead>
  )
}

export function TH({
  children,
  className,
  align = 'left',
}: {
  children?: ReactNode
  className?: string
  align?: 'left' | 'right' | 'center'
}) {
  return (
    <th
      scope="col"
      className={cn(
        'px-4 py-2.5 text-[12px] font-semibold uppercase tracking-wide text-[var(--text-3)] border-b border-[var(--border)]',
        align === 'right' && 'text-right',
        align === 'center' && 'text-center',
        align === 'left' && 'text-left',
        className,
      )}
    >
      {children}
    </th>
  )
}

export function TBody({ children }: { children: ReactNode }) {
  return <tbody>{children}</tbody>
}

export function TR({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <tr
      className={cn(
        'border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface-2)] transition-colors',
        className,
      )}
    >
      {children}
    </tr>
  )
}

export function TD({
  children,
  className,
  align = 'left',
}: {
  children?: ReactNode
  className?: string
  align?: 'left' | 'right' | 'center'
}) {
  return (
    <td
      className={cn(
        'px-4 py-3 text-[13.5px] text-[var(--text-2)] align-middle',
        align === 'right' && 'text-right',
        align === 'center' && 'text-center',
        className,
      )}
    >
      {children}
    </td>
  )
}
