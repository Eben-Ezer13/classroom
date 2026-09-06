import Link from 'next/link'
import type { ComponentProps, ReactNode } from 'react'
import { cn } from '@/lib/utils'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'subtle'
type Size = 'sm' | 'md' | 'lg' | 'icon'

const BASE =
  'inline-flex items-center justify-center gap-2 font-medium rounded-lg transition-colors ' +
  'disabled:opacity-50 disabled:pointer-events-none select-none whitespace-nowrap'

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-[var(--accent)] text-[var(--accent-contrast)] hover:bg-[var(--accent-hover)] shadow-[var(--shadow-sm)]',
  secondary:
    'bg-[var(--surface-1)] text-[var(--text-1)] border border-[var(--border-strong)] hover:bg-[var(--surface-3)]',
  ghost: 'text-[var(--text-2)] hover:bg-[var(--surface-3)] hover:text-[var(--text-1)]',
  danger:
    'bg-[var(--danger)] text-white hover:opacity-90 shadow-[var(--shadow-sm)]',
  subtle:
    'bg-[var(--accent-soft)] text-[var(--accent-strong)] border border-[var(--accent-border)] hover:brightness-95',
}

const SIZES: Record<Size, string> = {
  sm: 'h-8 px-3 text-[13px]',
  md: 'h-10 px-4 text-sm',
  lg: 'h-11 px-5 text-[15px]',
  icon: 'h-9 w-9 text-sm',
}

export function buttonClasses(variant: Variant = 'primary', size: Size = 'md', className?: string) {
  return cn(BASE, VARIANTS[variant], SIZES[size], className)
}

type ButtonProps = ComponentProps<'button'> & {
  variant?: Variant
  size?: Size
}

export function Button({ variant = 'primary', size = 'md', className, ...props }: ButtonProps) {
  return <button className={buttonClasses(variant, size, className)} {...props} />
}

type LinkButtonProps = ComponentProps<typeof Link> & {
  variant?: Variant
  size?: Size
  children: ReactNode
}

export function LinkButton({
  variant = 'primary',
  size = 'md',
  className,
  ...props
}: LinkButtonProps) {
  return <Link className={buttonClasses(variant, size, className)} {...props} />
}
