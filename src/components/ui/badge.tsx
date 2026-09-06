import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export type Tone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger' | 'info'

const TONES: Record<Tone, string> = {
  neutral: 'bg-[var(--surface-3)] text-[var(--text-2)] border-[var(--border)]',
  accent: 'bg-[var(--accent-soft)] text-[var(--accent-strong)] border-[var(--accent-border)]',
  success: 'bg-[var(--success-soft)] text-[var(--success-strong)] border-[var(--success-border)]',
  warning: 'bg-[var(--warning-soft)] text-[var(--warning-strong)] border-[var(--warning-border)]',
  danger: 'bg-[var(--danger-soft)] text-[var(--danger-strong)] border-[var(--danger-border)]',
  info: 'bg-[var(--info-soft)] text-[var(--info-strong)] border-[var(--info-border)]',
}

export function Badge({
  children,
  tone = 'neutral',
  className,
  dot = false,
}: {
  children: ReactNode
  tone?: Tone
  className?: string
  dot?: boolean
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11.5px] font-medium leading-5',
        TONES[tone],
        className,
      )}
    >
      {dot ? <span className="size-1.5 rounded-full bg-current opacity-70" /> : null}
      {children}
    </span>
  )
}

export function toTone(value: string | undefined): Tone {
  const allowed: Tone[] = ['neutral', 'accent', 'success', 'warning', 'danger', 'info']
  return allowed.includes(value as Tone) ? (value as Tone) : 'neutral'
}
