'use client'

import { useState } from 'react'
import { completeStudentOnboardingAction } from '@/app/actions/auth'
import { Button } from '@/components/ui/button'
import { SubmitButton } from '@/components/ui/submit-button'
import { useFormAction } from '@/components/ui/use-form-action'

type GuideSlide = {
  section: string
  icon: string
  title: string
  description: string
  hint?: string
}

/**
 * Parcours complet de l'espace étudiant. Les écrans expliquent uniquement
 * les fonctionnalités réellement accessibles avec le rôle MEMBER.
 */
const slides: GuideSlide[] = [
  {
    section: 'Bienvenue',
    icon: '👋',
    title: 'Bienvenue sur Classroom',
    description:
      "Cette visite vous montre où trouver vos cours, suivre votre travail et rester au courant de la vie de votre classe.",
    hint: 'Utilisez Suivant, Précédent ou les points de progression pour vous déplacer dans le guide.',
  },
  {
    section: 'Navigation',
    icon: '🧭',
    title: 'Repérez-vous dans la plateforme',
    description:
      'Le menu latéral donne accès à tous les espaces. Sur téléphone, ouvrez le menu en haut à gauche et utilisez la barre de navigation en bas.',
    hint: 'La barre supérieure permet aussi d’ouvrir la recherche, de changer le thème et d’accéder à votre compte.',
  },
  {
    section: 'Accueil',
    icon: '📊',
    title: 'Commencez par le tableau de bord',
    description:
      'C’est votre page d’accueil : vous y retrouvez les dernières publications, les prochaines échéances et les informations utiles de la classe.',
    hint: 'Revenez-y lorsque vous voulez voir rapidement ce qui est nouveau.',
  },
  {
    section: 'Organisation',
    icon: '🗓️',
    title: 'Consultez le programme',
    description:
      'La rubrique Programme réunit le contenu prévu, les éléments associés aux semestres et les mises à jour publiées par les délégués.',
    hint: 'Utilisez les informations de semestre pour savoir quelle période vous consultez.',
  },
  {
    section: 'Organisation',
    icon: '📖',
    title: 'Explorez les modules',
    description:
      'Les modules permettent de structurer les matières et leur contenu. Ouvrez-en un pour retrouver ce qui concerne un cours précis.',
    hint: 'Les ressources sont souvent rattachées à un module ou à une matière.',
  },
  {
    section: 'Cours',
    icon: '📚',
    title: 'Trouvez vos ressources',
    description:
      'Dans Ressources, accédez aux cours, TD, documents, liens et fichiers déposés pour la classe.',
    hint: 'Ouvrez une fiche pour consulter ses détails ou télécharger un fichier autorisé.',
  },
  {
    section: 'Cours',
    icon: '🔎',
    title: 'Recherchez plus vite',
    description:
      'La recherche globale vous aide à retrouver un document, une annonce ou une information sans parcourir toutes les rubriques.',
    hint: 'Utilisez l’icône de loupe dans la barre supérieure, puis saisissez un mot-clé.',
  },
  {
    section: 'Suivi',
    icon: '🎯',
    title: 'Suivez vos projets',
    description:
      'La page Projets rassemble les travaux à réaliser, leurs détails et les informations partagées par les délégués.',
    hint: 'Consultez régulièrement les projets en cours pour anticiper les livrables.',
  },
  {
    section: 'Suivi',
    icon: '⏰',
    title: 'Ne manquez aucune échéance',
    description:
      'Les contrôles, rendus et dates importantes se trouvent dans Échéances, avec leur date et les éventuelles consignes.',
    hint: 'Les dates qui approchent sont aussi mises en avant sur le tableau de bord.',
  },
  {
    section: 'Vie de classe',
    icon: '📣',
    title: 'Lisez les annonces',
    description:
      'Les délégués utilisent les annonces pour les communications importantes, les changements de dernière minute et les messages adressés à la classe.',
    hint: 'Une annonce peut vous mentionner directement ou concerner tous les étudiants.',
  },
  {
    section: 'Vie de classe',
    icon: '🗳️',
    title: 'Participez aux sondages',
    description:
      'Les sondages servent à recueillir l’avis de la classe sur une date, une activité ou une décision collective.',
    hint: 'Répondez avant la date de clôture pour que votre choix soit pris en compte.',
  },
  {
    section: 'Alertes',
    icon: '🔔',
    title: 'Consultez vos notifications',
    description:
      'La cloche vous avertit directement dans la plateforme lorsqu’une nouvelle ressource, annonce ou modification est publiée.',
    hint: 'Le compteur affiche les nouveautés non lues. Ouvrez Notifications pour tout consulter et marquer les éléments comme lus.',
  },
  {
    section: 'Échanges',
    icon: '💬',
    title: 'Signalez une difficulté',
    description:
      'Depuis Réclamations, vous pouvez transmettre une question ou un problème concernant la classe aux délégués.',
    hint: 'Vos réclamations restent privées : seuls vous et les responsables concernés peuvent les consulter.',
  },
  {
    section: 'Communauté',
    icon: '👥',
    title: 'Retrouvez les membres',
    description:
      'La page Membres vous permet de voir les personnes actives dans votre classe et de mieux identifier vos interlocuteurs.',
    hint: 'Les droits de chacun sont appliqués automatiquement par la plateforme.',
  },
  {
    section: 'Compte',
    icon: '⚙️',
    title: 'Gérez votre profil et vos classes',
    description:
      'Depuis votre avatar, accédez à Mon profil pour modifier vos informations, votre photo et votre mot de passe. Si vous appartenez à plusieurs classes, utilisez le sélecteur de classe dans le menu.',
    hint: 'Vous êtes prêt : commencez à explorer votre espace de classe.',
  },
]

/** Visite interactive, affichée une fois après la première connexion d'un étudiant. */
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
        <div className="min-h-[410px] px-6 py-8 text-center sm:px-12 sm:py-10" aria-live="polite">
          <span
            aria-hidden="true"
            className="inline-flex size-20 items-center justify-center rounded-full bg-[var(--accent-soft)] text-5xl shadow-[var(--shadow-sm)]"
          >
            {slide.icon}
          </span>
          <p className="mt-6 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent-strong)]">
            {slide.section}
          </p>
          <h2
            id="student-onboarding-title"
            className="mt-2 text-2xl font-semibold tracking-tight text-[var(--text-1)] sm:text-3xl"
          >
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
            className="mt-8 flex flex-wrap items-center justify-center gap-2"
            aria-label={'Étape ' + (step + 1) + ' sur ' + slides.length}
          >
            {slides.map((item, index) => (
              <button
                key={item.title}
                type="button"
                onClick={() => setStep(index)}
                aria-label={'Aller à l’étape ' + (index + 1) + ' : ' + item.title}
                aria-current={index === step ? 'step' : undefined}
                className={
                  'h-2.5 rounded-full transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] ' +
                  (index === step
                    ? 'w-8 bg-[var(--accent)]'
                    : 'w-2.5 bg-[var(--border-strong)] hover:bg-[var(--text-3)]')
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
