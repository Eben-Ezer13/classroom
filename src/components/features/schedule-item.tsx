import { Badge, toTone } from '@/components/ui/badge'
import { SCHEDULE_TYPE_LABELS, SCHEDULE_TYPE_TONE } from '@/lib/constants'
import { cn, minutesToTime } from '@/lib/utils'
import type { ReactNode } from 'react'

export type ScheduleItemData = {
  id: string
  type: string
  title: string | null
  startMinutes: number
  endMinutes: number
  room: string | null
  teacherName: string | null
  note: string | null
  isPublished?: boolean
  module: { code: string; name: string; color: string | null } | null
}

export function ScheduleItem({
  entry,
  actions,
  highlight = false,
}: {
  entry: ScheduleItemData
  actions?: ReactNode
  highlight?: boolean
}) {
  const label = entry.module ? entry.module.name : (entry.title ?? 'Seance')
  const accent = entry.module?.color ?? 'var(--border-strong)'

  return (
    <div
      className={cn(
        'relative flex gap-3.5 rounded-xl border p-3.5 transition-colors',
        highlight
          ? 'border-[var(--accent-border)] bg-[var(--accent-soft)]'
          : 'border-[var(--border)] bg-[var(--surface-1)] hover:bg-[var(--surface-2)]',
      )}
    >
      <span
        className="w-1 rounded-full shrink-0"
        style={{ background: accent }}
        aria-hidden="true"
      />

      <div className="shrink-0 w-[52px] pt-0.5">
        <p className="text-[14px] font-semibold tabular-nums text-[var(--text-1)] leading-tight">
          {minutesToTime(entry.startMinutes)}
        </p>
        <p className="text-[12px] tabular-nums text-[var(--text-3)] leading-tight">
          {minutesToTime(entry.endMinutes)}
        </p>
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-2 flex-wrap">
          <p className="text-[14px] font-medium text-[var(--text-1)] leading-snug">
            {label}
          </p>
          <Badge tone={toTone(SCHEDULE_TYPE_TONE[entry.type])}>
            {SCHEDULE_TYPE_LABELS[entry.type] ?? entry.type}
          </Badge>
          {entry.isPublished === false ? (
            <Badge tone="warning">Brouillon</Badge>
          ) : null}
        </div>

        <p className="mt-1 text-[12.5px] text-[var(--text-3)]">
          {[
            entry.module?.code,
            entry.room ? `Salle ${entry.room}` : null,
            entry.teacherName,
          ]
            .filter(Boolean)
            .join(' · ') || 'Aucun detail'}
        </p>

        {entry.note ? (
          <p className="mt-1.5 text-[12.5px] text-[var(--text-2)] leading-relaxed">
            {entry.note}
          </p>
        ) : null}
      </div>

      {actions ? <div className="shrink-0 flex items-start gap-1">{actions}</div> : null}
    </div>
  )
}
