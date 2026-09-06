/* eslint-disable @next/next/no-img-element */
import { cn, initials } from '@/lib/utils'

const SIZES = {
  sm: 'size-7 text-[11px]',
  md: 'size-9 text-[13px]',
  lg: 'size-12 text-[15px]',
  xl: 'size-20 text-2xl',
}

export function Avatar({
  firstName,
  lastName,
  src,
  size = 'md',
  className,
}: {
  firstName: string
  lastName: string
  src?: string | null
  size?: keyof typeof SIZES
  className?: string
}) {
  const label = `${firstName} ${lastName}`
  if (src) {
    return (
      <img
        src={src}
        alt={label}
        className={cn('rounded-full object-cover bg-[var(--surface-3)]', SIZES[size], className)}
      />
    )
  }
  return (
    <span
      aria-label={label}
      title={label}
      className={cn(
        'rounded-full grid place-items-center font-semibold shrink-0',
        'bg-[var(--accent-soft)] text-[var(--accent-strong)] border border-[var(--accent-border)]',
        SIZES[size],
        className,
      )}
    >
      {initials(firstName, lastName)}
    </span>
  )
}
