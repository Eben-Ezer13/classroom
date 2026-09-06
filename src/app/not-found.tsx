import Link from 'next/link'
import { buttonClasses } from '@/components/ui/button'
import { IconSearch } from '@/components/ui/icons'

export default function NotFound() {
  return (
    <div className="min-h-dvh grid place-items-center px-4">
      <div className="text-center max-w-md">
        <span className="inline-grid place-items-center size-12 rounded-2xl bg-[var(--surface-3)] text-[var(--text-3)]">
          <IconSearch className="size-5" />
        </span>
        <h1 className="mt-4 text-[22px] font-semibold tracking-[-0.02em] text-[var(--text-1)]">
          Page introuvable
        </h1>
        <p className="mt-2 text-[14px] text-[var(--text-2)] leading-relaxed">
          Cette page n existe pas, ou l element demande ne fait pas partie de votre
          classe.
        </p>
        <Link href="/dashboard" className={buttonClasses('primary', 'md', 'mt-6')}>
          Retour au tableau de bord
        </Link>
      </div>
    </div>
  )
}
