import type { ComponentProps, ReactNode } from 'react'
import { cn } from '@/lib/utils'

const CONTROL =
  'w-full rounded-lg border border-[var(--border-strong)] bg-[var(--surface-1)] px-3 text-sm ' +
  'text-[var(--text-1)] placeholder:text-[var(--text-3)] transition-colors ' +
  'focus:border-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/20 ' +
  'disabled:opacity-60 disabled:bg-[var(--surface-3)]'

export function Field({
  label,
  htmlFor,
  hint,
  error,
  required,
  children,
  className,
}: {
  label?: ReactNode
  htmlFor?: string
  hint?: ReactNode
  error?: string[] | string
  required?: boolean
  children: ReactNode
  className?: string
}) {
  const message = Array.isArray(error) ? error[0] : error
  return (
    <div className={cn('space-y-1.5', className)}>
      {label ? (
        <label
          htmlFor={htmlFor}
          className="block text-[13px] font-medium text-[var(--text-2)]"
        >
          {label}
          {required ? <span className="text-[var(--danger)] ml-0.5">*</span> : null}
        </label>
      ) : null}
      {children}
      {message ? (
        <p className="text-[12.5px] text-[var(--danger)]">{message}</p>
      ) : hint ? (
        <p className="text-[12.5px] text-[var(--text-3)]">{hint}</p>
      ) : null}
    </div>
  )
}

export function Input({ className, ...props }: ComponentProps<'input'>) {
  return <input className={cn(CONTROL, 'h-10', className)} {...props} />
}

export function Textarea({ className, ...props }: ComponentProps<'textarea'>) {
  return <textarea className={cn(CONTROL, 'py-2.5 min-h-24 resize-y', className)} {...props} />
}

export function Select({ className, children, ...props }: ComponentProps<'select'>) {
  return (
    <select className={cn(CONTROL, 'h-10 pr-8 cursor-pointer', className)} {...props}>
      {children}
    </select>
  )
}

export function Checkbox({
  label,
  className,
  ...props
}: ComponentProps<'input'> & { label: ReactNode }) {
  return (
    <label
      className={cn(
        'flex items-center gap-2.5 text-sm text-[var(--text-2)] cursor-pointer select-none',
        className,
      )}
    >
      <input
        type="checkbox"
        className="size-4 rounded border-[var(--border-strong)] accent-[var(--accent)] cursor-pointer"
        {...props}
      />
      {label}
    </label>
  )
}
