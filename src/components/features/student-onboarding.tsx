'use client'

import { useState } from 'react'
import { completeStudentOnboardingAction } from '@/app/actions/auth'
import { Button } from '@/components/ui/button'
import { SubmitButton } from '@/components/ui/submit-button'
import { useFormAction } from '@/components/ui/use-form-action'

type GuideSlide = {
  eyebrow: string
  icon: string
  title: string
  description: string
  hint?: string
}

const slides: GuideSlide[] = [
  {
    eyebrow: 'Bienvenue',
    icon: '👋',
    title: 'Bienvenue sur Classroom',
    description:
      "En moins d’une minute, découvrez où retrouver vos cours, les informations de la classe et vos échéances.",
  },
  {
    eyebrow: 'Votre espace',
    icon: '📊',
    title: 'Le tableau de bord',
    description:
      'C’est votre point de départ : consultez les dernières publications, les prochaines échéances et les informations importantes.',
    hint: 'Ouvrez « Tableau de bord » dans le menu pour revenir ici à tout moment.',
  },
  {
    eyebrow: 'Apprendre',
    icon: '📚',
    title: 'Vos ressources de cours',
    description:
      'Retrouvez les cours, TD, documents et fichiers déposés par les délégués dans la rubrique Ressources.',
    hint: 'Vous pouvez rechercher une ressource et la télécharger depuis sa fiche.',
  },
  {
    eyebrow: 'S’organiser',
    icon: '🗓️',
    title: 'Programme et emploi du temps',
    description:
      'Le programme, les emplois du temps et les informations de semestre sont accessibles depuis le menu.',
    hint: 'Consultez-les régulièrement pour ne manquer aucun changement.',
  },
  {
    eyebrow: 'Suivre son travail',
    icon: '🎯',
    title: 'Projets et échéances',
    description:
      'Les projets à réaliser et les dates importantes sont regroupés dans des espaces dédiés.',
    hint: 'Les dates proches apparaissent aussi sur votre tableau de bord.',
  },
  {
    eyebrow: 'Participer',
    icon: '📣',
    title: 'Annonces, sondages et réclamations',
    description:
      'Lisez les annonces de la classe, répondez aux sondages et signalez une difficulté depuis Réclamations.',
    hint: 'Vos réclamations restent visibles uniquement par vous et les délégués concernés.',
  },
  {
    eyebrow: 'Rester informé',
    icon: '🔔',
    title: 'Vos notifications',
    description:
      'La cloche de la plateforme vous informe des nouvelles ressources, annonces et modifications publiées dans votre classe.',
    hint: 'Le compteur indique les nouveautés que vous n’avez pas encore consultées.',
  },
]

/** Tutoriel pas à pas affiché une seule fois après la première connexion d'un étudiant. */
export function StudentOnboarding() {
  const [step, setStep] = useState(0)
  const { state, formAction } = useFormAction(completeStudentOnboardingAction)
  const slide = slides[step]
  const isLast = step === slides.length - 1

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="student-onboarding-title"
    >
      <form
        action={formAction}
        className="w-full max-w-2xl overflow-hidden rounded-[28px] border border-[var(--border-strong)] bg-[var(--surface-1)] shadow-2xl"
      >
        <div className="min-h-[390px] px-6 py-8 text-center sm:px-12 sm:py-10">
          <span className="inline-flex size-20 items-center justify-center rounded-full bg-[var(--accent-soft)] text-5xl shadow-[var(--shadow-sm)]">
            {slide.icon}
          </span>
          <p className="mt-6 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent-strong)]">
            {slide.eyebrow}
          </p>
          <h2 id="student-onboarding-title" className="mt-2 text-2xl font-semibold tracking-tight text-[var(--text-1)] sm:text-3xl">
            {slide.title}
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-base leading-7 text-[var(--text-2)] sm:text-lg">
            {slide.description}
          </p>
          {slide.hint ? (
            <p className="mx-auto mt-5 max-w-xl rounded-xl bg-[var(--surface-2)] px-4 py-3 text-sm leading-6 text-[var(--text-3)]">
              {slide.hint}
            </p>
          ) : null}

          <div
            className="mt-9 flex items-center justify-center gap-2"
            aria-label={'Étape ' + (step + 1) + ' sur ' + slides.length}
          >
            {slides.map((item, index) => (
              <span
                key={item.title}
                className={
                  'h-2.5 rounded-full transition-all ' +
                  (index === step
                    ? 'w-8 bg-[var(--accent)]'
                    : 'w-2.5 bg-[var(--border-strong)]')
                }
              />
            ))}
          </div>
          <p className="mt-3 text-sm text-[var(--text-3)]">
            Étape {step + 1} / {slides.length}
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] bg-[var(--surface-2)] px-5 py-4 sm:px-7">
          <Button type="submit" variant="ghost">
            Passer le guide
          </Button>
          <div className="flex items-center gap-2">
            {step > 0 ? (
              <Button type="button" variant="secondary" onClick={() => setStep((current) => current - 1)}>
                Précédent
              </Button>
            ) : null}
            {isLast ? (
              <SubmitButton pendingLabel="Ouverture...">Commencer</SubmitButton>
            ) : (
              <Button type="button" onClick={() => setStep((current) => current + 1)}>
                Suivant
              </Button>
            )}
          </div>
        </div>
        {!state.ok && state.message ? (
          <p className="border-t border-[var(--border)] px-6 py-3 text-sm text-[var(--danger)]">{state.message}</p>
        ) : null}
      </form>
    </div>
  )
}
