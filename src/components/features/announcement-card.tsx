import type { ReactNode } from 'react'
import { Badge, toTone } from '@/components/ui/badge'
import {
  ANNOUNCEMENT_CATEGORY_LABELS,
  ANNOUNCEMENT_LEVEL_LABELS,
  ANNOUNCEMENT_LEVEL_TONE,
} from '@/lib/constants'
import { cn, formatRelative } from '@/lib/utils'
import { IconWarning } from '@/components/ui/icons'

export type AnnouncementData = {
  id: string
  title: string
  content: string
  level: string
  category: string
  publishedAt: Date
  isPinned?: boolean
  module?: { code: string; name: string } | null
  author: { firstName: string; lastName: string } | null
}

export function AnnouncementCard({
  announcement,
  actions,
  compact = false,
}: {
  announcement: AnnouncementData
  actions?: ReactNode
  compact?: boolean
}) {
  const urgent = announcement.level === 'URGENT'
  const important = announcement.level === 'IMPORTANT'

  return (
    <article
      className={cn(
        'rounded-xl border p-4 transition-colors',
        urgent
          ? 'border-[var(--danger-border)] bg-[var(--danger-soft)]'
          : important
            ? 'border-[var(--warning-border)] bg-[var(--warning-soft)]'
            : 'border-[var(--border)] bg-[var(--surface-1)]',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            {urgent ? (
              <span className="text-[var(--danger)] shrink-0">
                <IconWarning className="size-4" />
              </span>
            ) : null}
            <h3
              className={cn(
                'text-[14.5px] font-semibold leading-snug',
                urgent
                  ? 'text-[var(--danger-strong)]'
                  : important
                    ? 'text-[var(--warning-strong)]'
                    : 'text-[var(--text-1)]',
              )}
            >
              {announcement.title}
            </h3>
            {announcement.isPinned ? <Badge tone="accent">Epinglee</Badge> : null}
          </div>

          <p
            className={cn(
              'mt-1.5 text-[13.5px] leading-relaxed whitespace-pre-line',
              urgent
                ? 'text-[var(--danger-strong)]'
                : important
                  ? 'text-[var(--warning-strong)]'
                  : 'text-[var(--text-2)]',
              compact && 'line-clamp-3',
            )}
          >
            {announcement.content}
          </p>
        </div>

        {actions ? <div className="shrink-0 flex items-start gap-1">{actions}</div> : null}
      </div>

      <div className="mt-3 flex items-center gap-2 flex-wrap">
        <Badge tone={toTone(ANNOUNCEMENT_LEVEL_TONE[announcement.level])} dot={urgent}>
          {ANNOUNCEMENT_LEVEL_LABELS[announcement.level] ?? announcement.level}
        </Badge>
        <Badge>
          {ANNOUNCEMENT_CATEGORY_LABELS[announcement.category] ?? announcement.category}
        </Badge>
        {announcement.module ? <Badge tone="info">{announcement.module.code}</Badge> : null}
        <span className="text-[12px] text-[var(--text-3)] ml-auto">
          {announcement.author
            ? `${announcement.author.firstName} ${announcement.author.lastName} · `
            : ''}
          {formatRelative(announcement.publishedAt)}
        </span>
      </div>
    </article>
  )
}
