import type { ReactNode } from 'react'
import { Badge } from '@/components/ui/badge'
import { DEADLINE_CATEGORY_LABELS } from '@/lib/constants'
import { cn, formatCountdown, formatDateTime } from '@/lib/utils'

export type DeadlineData = {
  id: string
  title: string
  category: string
  dueAt: Date
  description?: string | null
  module: { code: string; name: string } | null
}

/** Urgence derivee du temps restant : gouverne la couleur du compte a rebours. */
function urgency(dueAt: Date): 'overdue' | 'today' | 'soon' | 'later' {
  const diff = dueAt.getTime() - Date.now()
  if (diff < 0) return 'overdue'
  if (diff < 86_400_000) return 'today'
  if (diff < 3 * 86_400_000) return 'soon'
  return 'later'
}

const COUNTDOWN_CLASS: Record<ReturnType<typeof urgency>, string> = {
  overdue: 'text-[var(--danger)]',
  today: 'text-[var(--danger)]',
  soon: 'text-[var(--warning)]',
  later: 'text-[var(--text-3)]',
}

export function DeadlineItem({
  deadline,
  actions,
}: {
  deadline: DeadlineData
  actions?: ReactNode
}) {
  const level = urgency(deadline.dueAt)

  return (
    <div className="flex items-start gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-1)] p-3.5 hover:bg-[var(--surface-2)] transition-colors">
      <span
        className={cn(
          'mt-1 size-2 rounded-full shrink-0',
          level === 'overdue' || level === 'today'
            ? 'bg-[var(--danger)]'
            : level === 'soon'
              ? 'bg-[var(--warning)]'
              : 'bg-[var(--border-strong)]',
        )}
        aria-hidden="true"
      />

      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-medium text-[var(--text-1)] leading-snug">
          {deadline.title}
        </p>
        {deadline.description ? (
          <p className="mt-1 text-[12.5px] text-[var(--text-2)] line-clamp-2 leading-relaxed">
            {deadline.description}
          </p>
        ) : null}
        <div className="mt-2 flex items-center gap-2 flex-wrap">
          <Badge>{DEADLINE_CATEGORY_LABELS[deadline.category] ?? deadline.category}</Badge>
          {deadline.module ? <Badge tone="info">{deadline.module.code}</Badge> : null}
          <span className="text-[12px] text-[var(--text-3)]">
            {formatDateTime(deadline.dueAt)}
          </span>
        </div>
      </div>

      <div className="shrink-0 text-right flex flex-col items-end gap-1">
        <span className={cn('text-[12.5px] font-medium', COUNTDOWN_CLASS[level])}>
          {formatCountdown(deadline.dueAt)}
        </span>
        {actions}
      </div>
    </div>
  )
}
