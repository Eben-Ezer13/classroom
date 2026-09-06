import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import type { Tone } from './badge'

const ALERT_TONES: Record<Tone, string> = {
  neutral: 'bg-[var(--surface-3)] text-[var(--text-2)] border-[var(--border)]',
  accent: 'bg-[var(--accent-soft)] text-[var(--accent-strong)] border-[var(--accent-border)]',
  success: 'bg-[var(--success-soft)] text-[var(--success-strong)] border-[var(--success-border)]',
  warning: 'bg-[var(--warning-soft)] text-[var(--warning-strong)] border-[var(--warning-border)]',
  danger: 'bg-[var(--danger-soft)] text-[var(--danger-strong)] border-[var(--danger-border)]',
  info: 'bg-[var(--info-soft)] text-[var(--info-strong)] border-[var(--info-border)]',
}

export function Alert({
  children,
  tone = 'info',
  className,
}: {
  children: ReactNode
  tone?: Tone
  className?: string
}) {
  return (
    <div
      role={tone === 'danger' ? 'alert' : 'status'}
      className={cn(
        'rounded-lg border px-3.5 py-2.5 text-[13px] leading-relaxed animate-fade-in',
        ALERT_TONES[tone],
        className,
      )}
    >
      {children}
    </div>
  )
}

export function EmptyState({
  title,
  description,
  action,
  icon,
  className,
}: {
  title: string
  description?: string
  action?: ReactNode
  icon?: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center px-6 py-14 gap-3',
        className,
      )}
    >
      {icon ? (
        <div className="size-11 rounded-xl bg-[var(--surface-3)] text-[var(--text-3)] grid place-items-center">
          {icon}
        </div>
      ) : null}
      <div className="space-y-1">
        <p className="text-sm font-medium text-[var(--text-1)]">{title}</p>
        {description ? (
          <p className="text-[13px] text-[var(--text-3)] max-w-sm mx-auto leading-relaxed">
            {description}
          </p>
        ) : null}
      </div>
      {action}
    </div>
  )
}

export function StatTile({
  label,
  value,
  hint,
  tone = 'neutral',
  icon,
}: {
  label: string
  value: ReactNode
  hint?: ReactNode
  tone?: Tone
  icon?: ReactNode
}) {
  const accents: Record<Tone, string> = {
    neutral: 'text-[var(--text-2)]',
    accent: 'text-[var(--accent)]',
    success: 'text-[var(--success)]',
    warning: 'text-[var(--warning)]',
    danger: 'text-[var(--danger)]',
    info: 'text-[var(--info)]',
  }
  return (
    <div className="bg-[var(--surface-1)] border border-[var(--border)] rounded-2xl p-4 shadow-[var(--shadow-sm)]">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[12.5px] font-medium text-[var(--text-3)] uppercase tracking-wide">
          {label}
        </p>
        {icon ? <span className={accents[tone]}>{icon}</span> : null}
      </div>
      <p className="mt-2 text-[26px] font-semibold leading-none tabular-nums text-[var(--text-1)]">
        {value}
      </p>
      {hint ? <p className="mt-1.5 text-[12.5px] text-[var(--text-3)]">{hint}</p> : null}
    </div>
  )
}
