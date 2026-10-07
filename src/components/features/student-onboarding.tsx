'use client'

import { completeStudentOnboardingAction } from '@/app/actions/auth'
import { SubmitButton } from '@/components/ui/submit-button'
import { useFormAction } from '@/components/ui/use-form-action'

/** Guide affiche une fois apres la premiere connexion d'un etudiant. */
export function StudentOnboarding() {
  const { state, formAction } = useFormAction(completeStudentOnboardingAction)

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="student-onboarding-title"
    >
      <div className="w-full max-w-xl overflow-hidden rounded-2xl border border-[var(--border-strong)] bg-[var(--surface-1)] shadow-2xl">
        <div className="border-b border-[var(--border)] px-6 py-5">
          <p className="text-xs font-semibold uppercase tracking-widest text-[var(--accent-strong)]">
            Guide de démarrage
          </p>
          <h2 id="student-onboarding-title" className="mt-1 text-xl font-semibold text-[var(--text-1)]">
            Bienvenue sur Classroom
          </h2>
          <p className="mt-1 text-sm text-[var(--text-3)]">
            Voici l’essentiel pour suivre votre classe sans rien manquer.
          </p>
        </div>

        <ol className="space-y-4 px-6 py-5 text-sm text-[var(--text-2)]">
          <GuideStep number="1" title="Consultez le tableau de bord">
            Vous y retrouvez les nouveautés, les échéances et les éléments importants.
          </GuideStep>
          <GuideStep number="2" title="Ouvrez vos ressources">
            Les cours, TD, documents et fichiers publiés par le délégué sont dans Ressources.
          </GuideStep>
          <GuideStep number="3" title="Suivez le programme">
            Programme, emplois du temps, projets et échéances sont regroupés dans le menu.
          </GuideStep>
          <GuideStep number="4" title="Activez vos alertes e-mail">
            Dans Mon profil, vous pouvez demander un e-mail à chaque publication ou changement de classe.
          </GuideStep>
        </ol>

        <form action={formAction} className="flex items-center justify-between gap-4 border-t border-[var(--border)] bg-[var(--surface-2)] px-6 py-4">
          <p className="text-xs text-[var(--text-3)]">Vous pourrez commencer immédiatement.</p>
          <SubmitButton pendingLabel="Ouverture...">Commencer</SubmitButton>
        </form>
        {!state.ok && state.message ? (
          <p className="px-6 pb-4 text-sm text-[var(--danger)]">{state.message}</p>
        ) : null}
      </div>
    </div>
  )
}

function GuideStep({ number, title, children }: { number: string; title: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-[var(--accent-soft)] text-xs font-bold text-[var(--accent-strong)]">
        {number}
      </span>
      <span>
        <strong className="block font-medium text-[var(--text-1)]">{title}</strong>
        {children}
      </span>
    </li>
  )
}
