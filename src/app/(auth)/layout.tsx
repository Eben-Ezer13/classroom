import Link from 'next/link'
import type { ReactNode } from 'react'
import { IconGraduation } from '@/components/ui/icons'
import { ThemeToggle } from '@/components/layout/theme'

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh grid lg:grid-cols-[1fr_minmax(420px,44%)]">
      {/* Panneau de presentation, masque sur mobile pour laisser la place
          au formulaire. */}
      <aside className="hidden lg:flex flex-col justify-between p-10 bg-[var(--surface-1)] border-r border-[var(--border)] relative overflow-hidden">
        <div
          aria-hidden="true"
          className="absolute -top-32 -left-24 size-[420px] rounded-full blur-3xl opacity-[0.18]"
          style={{ background: 'var(--accent)' }}
        />
        <div className="relative">
          <div className="flex items-center gap-2.5">
            <span className="size-9 rounded-xl bg-[var(--accent)] text-[var(--accent-contrast)] grid place-items-center">
              <IconGraduation className="size-5" />
            </span>
            <span className="text-[15px] font-semibold text-[var(--text-1)]">
              Gestion de classe
            </span>
          </div>
        </div>

        <div className="relative max-w-md">
          <h2 className="text-[30px] leading-[1.2] font-semibold tracking-[-0.02em] text-[var(--text-1)]">
            Toute la vie de la classe, au meme endroit.
          </h2>
          <p className="mt-3.5 text-[14.5px] leading-relaxed text-[var(--text-2)]">
            Programme, ressources, annonces, projets et echeances. Le delegue
            publie une fois, toute la classe est informee.
          </p>
          <ul className="mt-7 space-y-2.5">
            {[
              'Emploi du temps et prochaines seances',
              'Cours, TD, TP et corrections telechargeables',
              'Echeances, projets et rappels',
              'Annonces urgentes, sondages et reclamations',
            ].map((item) => (
              <li key={item} className="flex items-start gap-2.5 text-[13.5px] text-[var(--text-2)]">
                <span className="mt-1.5 size-1.5 rounded-full bg-[var(--accent)] shrink-0" />
                {item}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-[12px] text-[var(--text-3)]">
          Plateforme academique privee.
        </p>
      </aside>

      <main className="flex flex-col">
        <div className="flex items-center justify-between p-4 lg:justify-end">
          <Link href="/" className="lg:hidden flex items-center gap-2">
            <span className="size-8 rounded-lg bg-[var(--accent)] text-[var(--accent-contrast)] grid place-items-center">
              <IconGraduation className="size-[18px]" />
            </span>
            <span className="text-[14px] font-semibold text-[var(--text-1)]">
              Gestion de classe
            </span>
          </Link>
          <ThemeToggle />
        </div>
        <div className="flex-1 flex items-center justify-center px-4 pb-10">
          <div className="w-full max-w-[400px] animate-fade-up">{children}</div>
        </div>
      </main>
    </div>
  )
}
