import type { Metadata } from 'next'
import Link from 'next/link'
import { requirePageClassAdmin } from '@/lib/auth/guards'
import { PageHeader } from '@/components/layout/page-header'
import { Card, CardBody, CardHeader } from '@/components/ui/card'

export const metadata: Metadata = { title: 'Guide du délégué' }

const guideSections = [
  {
    title: '1. Créer et organiser votre classe',
    description:
      'La vue générale présente l’activité de votre classe, le nombre de membres, les ressources, les annonces, les réclamations en attente et l’espace de stockage.',
    steps: [
      'Dans Membres et invitations, partagez le code ou créez un lien d’invitation. Vérifiez les membres inscrits et leur rôle.',
      'Dans Paramètres de la classe, mettez à jour les informations affichées sur l’espace de classe.',
      'Dans Années et semestres, préparez les périodes qui serviront à organiser le programme et les modules.',
    ],
    links: [
      ['Vue générale', '/admin'],
      ['Membres et invitations', '/admin/membres'],
      ['Paramètres de la classe', '/admin/parametres'],
      ['Années et semestres', '/admin/annees'],
    ],
  },
  {
    title: '2. Publier les informations de cours',
    description:
      'Les sections de travail permettent de centraliser le contenu de la classe pour que les étudiants le retrouvent au même endroit.',
    steps: [
      'Programme : consultez et organisez les cours, travaux dirigés, travaux pratiques et examens.',
      'Modules : regroupez le travail par matière ou module.',
      'Ressources : partagez les documents de cours et corrections. La recherche aide à retrouver les contenus publiés.',
    ],
    links: [
      ['Programme', '/programme'],
      ['Modules', '/modules'],
      ['Ressources', '/ressources'],
      ['Recherche', '/recherche'],
    ],
  },
  {
    title: '3. Suivre le travail et communiquer',
    description:
      'Utilisez les espaces de suivi pour garder les échéances et les informations importantes visibles.',
    steps: [
      'Projets et Échéances : publiez les travaux à réaliser et leurs dates limites.',
      'Annonces : transmettez une information à toute la classe et signalez les messages importants.',
      'Sondages : recueillez rapidement l’avis des membres.',
      'Messages : échangez en temps réel, partagez des annonces, échéances, liens et fichiers, réagissez aux messages et retrouvez les pièces jointes dans la galerie.',
      'Le délégué peut épingler une information et traiter les signalements envoyés par les membres. Les auteurs peuvent supprimer leurs propres messages.',
      'Notifications : consultez les alertes et ouvrez directement l’élément concerné.',
      'Réclamations : suivez les demandes envoyées par les étudiants.',
    ],
    links: [
      ['Projets', '/projets'],
      ['Échéances', '/echeances'],
      ['Annonces', '/annonces'],
      ['Sondages', '/sondages'],
      ['Messages', '/messages'],
      ['Notifications', '/notifications'],
      ['Réclamations', '/reclamations'],
    ],
  },
  {
    title: '4. Gérer et protéger votre espace',
    description:
      'Les outils d’administration sont limités à votre classe. Les étudiants et le délégué disposent de droits différents.',
    steps: [
      'Archives : consultez les éléments archivés et restaurez ceux qui doivent être réutilisés.',
      'Statistiques : suivez les indicateurs de votre classe, notamment l’activité et le stockage.',
      'Journal d’audit : retrouvez les principales opérations réalisées dans l’espace.',
      'Chaque membre ne voit que les données des classes auxquelles il appartient. N’envoyez dans les discussions que des documents destinés aux membres de la classe.',
    ],
    links: [
      ['Archives', '/admin/archives'],
      ['Statistiques', '/admin/statistiques'],
      ['Journal d’audit', '/admin/audit'],
    ],
  },
  {
    title: '5. Profil et réglages personnels',
    description:
      'Depuis Mon profil, chaque membre peut gérer ses informations, sa photo, son mot de passe, les alertes e-mail et les notifications de son appareil.',
    steps: [
      'Utilisez le menu de profil pour modifier la photo et les informations personnelles.',
      'Les notifications push nécessitent un navigateur compatible et leur configuration sur le serveur ; sur iPhone/iPad, installez d’abord Classroom depuis Safari.',
      'Le thème clair/sombre et l’installation de l’application concernent votre appareil et votre compte.',
    ],
    links: [['Mon profil', '/profil']],
  },
]

export default async function DelegateGuidePage() {
  await requirePageClassAdmin()

  return (
    <>
      <PageHeader
        title="Guide du délégué"
        description="Un parcours pour présenter Classroom et accompagner les étudiants."
      />
      <div className="space-y-4">
        <Card>
          <CardHeader
            title="Parcours de présentation"
            description="Vous pouvez suivre les étapes dans l’ordre ou ouvrir directement une section."
          />
          <CardBody className="space-y-6">
            {guideSections.map((section) => (
              <section key={section.title} className="space-y-2">
                <h2 className="text-sm font-semibold text-[var(--text-1)]">{section.title}</h2>
                <p className="text-[13px] leading-relaxed text-[var(--text-2)]">
                  {section.description}
                </p>
                <ul className="list-disc space-y-1 pl-5 text-[13px] leading-relaxed text-[var(--text-2)]">
                  {section.steps.map((step) => <li key={step}>{step}</li>)}
                </ul>
                <div className="flex flex-wrap gap-x-4 gap-y-1">
                  {section.links.map(([label, href]) => (
                    <Link
                      key={href}
                      href={href}
                      className="text-[12.5px] font-medium text-[var(--accent)] hover:underline"
                    >
                      {label}
                    </Link>
                  ))}
                </div>
              </section>
            ))}
          </CardBody>
        </Card>
        <p className="text-xs leading-relaxed text-[var(--text-3)]">
          Les fonctions disponibles peuvent dépendre du rôle de la personne et des réglages de la classe.
          En cas de question sur un accès, vérifiez d’abord l’appartenance et le rôle dans Membres et invitations.
        </p>
      </div>
    </>
  )
}
