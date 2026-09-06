import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export function Card({
  children,
  className,
  id,
  as: Tag = 'div',
}: {
  children: ReactNode
  className?: string
  id?: string
  as?: 'div' | 'section' | 'article' | 'li'
}) {
  return (
    <Tag
      id={id}
      className={cn(
        'bg-[var(--surface-1)] border border-[var(--border)] rounded-2xl shadow-[var(--shadow-sm)]',
        className,
      )}
    >
      {children}
    </Tag>
  )
}

export function CardHeader({
  title,
  description,
  action,
  className,
}: {
  title: ReactNode
  description?: ReactNode
  action?: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex items-start justify-between gap-4 px-5 py-4 border-b border-[var(--border)]',
        className,
      )}
    >
      <div className="min-w-0">
        <h2 className="text-[15px] font-semibold text-[var(--text-1)] truncate">{title}</h2>
        {description ? (
          <p className="text-[13px] text-[var(--text-3)] mt-0.5">{description}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  )
}

export function CardBody({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return <div className={cn('p-5', className)}>{children}</div>
}

export function CardFooter({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'px-5 py-3.5 border-t border-[var(--border)] bg-[var(--surface-2)] rounded-b-2xl',
        className,
      )}
    >
      {children}
    </div>
  )
}
