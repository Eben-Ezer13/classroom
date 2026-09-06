import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth/session'
import { buttonClasses } from '@/components/ui/button'
import { ThemeToggle } from '@/components/layout/theme'
import {
  IconBell,
  IconCalendar,
  IconClock,
  IconFolder,
  IconGraduation,
  IconMegaphone,
  IconPoll,
} from '@/components/ui/icons'

export const dynamic = 'force-dynamic'

const FEATURES = [
  {
    icon: IconCalendar,
    title: 'Programme hebdomadaire',
    text: 'Seances, salles, professeurs et changements de dernière minute, publies par le delegue.',
  },
  {
    icon: IconFolder,
    title: 'Ressources centralisees',
    text: 'Cours, TD, TP, corrections et sujets d examen, classes par module et par semestre.',
  },
  {
    icon: IconClock,
    title: 'Echeances et projets',
    text: 'Chaque rendu avec son compte a rebours, ses consignes et ses documents.',
  },
  {
    icon: IconMegaphone,
    title: 'Annonces hierarchisees',
    text: 'Une annonce urgente se distingue immediatement des informations courantes.',
  },
  {
    icon: IconPoll,
    title: 'Sondages',
    text: 'Decidez collectivement d une date de rattrapage ou d un choix de sujet.',
  },
  {
    icon: IconBell,
    title: 'Notifications',
    text: 'Chaque publication previent la classe, avec compteur de non-lus.',
  },
]

export default async function HomePage() {
  const user = await getCurrentUser()
  if (user) redirect('/dashboard')

  return (
    <div className="min-h-dvh flex flex-col">
      <header className="h-16 flex items-center justify-between px-4 sm:px-8 border-b border-[var(--border)]">
        <div className="flex items-center gap-2.5">
          <span className="size-8 rounded-lg bg-[var(--accent)] text-[var(--accent-contrast)] grid place-items-center">
            <IconGraduation className="size-[18px]" />
          </span>
          <span className="text-[15px] font-semibold text-[var(--text-1)]">
            Gestion de classe
          </span>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Link href="/login" className={buttonClasses('secondary', 'sm')}>
            Connexion
          </Link>
          <Link href="/register" className={buttonClasses('primary', 'sm', 'hidden sm:inline-flex')}>
            Creer un compte
          </Link>
        </div>
      </header>

      <main className="flex-1">
        <section className="px-4 sm:px-8 py-16 sm:py-24 max-w-5xl mx-auto text-center">
          <p className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface-1)] px-3 py-1 text-[12.5px] text-[var(--text-2)]">
            <span className="size-1.5 rounded-full bg-[var(--success)]" />
            Plateforme academique privee
          </p>
          <h1 className="mt-5 text-[34px] sm:text-[48px] leading-[1.1] font-semibold tracking-[-0.03em] text-[var(--text-1)]">
            Toute la vie de la classe,
            <br className="hidden sm:block" /> au meme endroit.
          </h1>
          <p className="mt-5 text-[15px] sm:text-[17px] leading-relaxed text-[var(--text-2)] max-w-2xl mx-auto">
            Le delegue publie le programme, les ressources et les echeances.
            Chaque etudiant retrouve son espace personnel, a jour, sur mobile
            comme sur ordinateur.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link href="/register" className={buttonClasses('primary', 'lg', 'w-full sm:w-auto')}>
              Rejoindre ma classe
            </Link>
            <Link href="/login" className={buttonClasses('secondary', 'lg', 'w-full sm:w-auto')}>
              J ai deja un compte
            </Link>
          </div>
        </section>

        <section className="px-4 sm:px-8 pb-20 max-w-6xl mx-auto">
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {FEATURES.map(({ icon: Icon, title, text }) => (
              <div
                key={title}
                className="bg-[var(--surface-1)] border border-[var(--border)] rounded-2xl p-5 shadow-[var(--shadow-sm)]"
              >
                <span className="size-9 rounded-lg bg-[var(--accent-soft)] text-[var(--accent)] grid place-items-center">
                  <Icon />
                </span>
                <h2 className="mt-3.5 text-[14.5px] font-semibold text-[var(--text-1)]">
                  {title}
                </h2>
                <p className="mt-1.5 text-[13.5px] leading-relaxed text-[var(--text-2)]">
                  {text}
                </p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-[var(--border)] px-4 sm:px-8 py-5">
        <p className="text-[12.5px] text-[var(--text-3)] text-center">
          Plateforme de gestion de classe — acces reserve aux membres inscrits.
        </p>
      </footer>
    </div>
  )
}
