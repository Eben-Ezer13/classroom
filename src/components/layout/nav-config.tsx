import type { ComponentType, SVGProps } from 'react'
import {
  IconActivity,
  IconArchive,
  IconBell,
  IconBook,
  IconBuilding,
  IconCalendar,
  IconClock,
  IconComplaint,
  IconDashboard,
  IconFolder,
  IconGraduation,
  IconLayers,
  IconMegaphone,
  IconPoll,
  IconProject,
  IconSearch,
  IconShield,
  IconUsers,
} from '@/components/ui/icons'

/** Role dans la classe active : seule dimension qui pilote la navigation. */
export type Role = 'ADMIN' | 'MEMBER'

export type NavItem = {
  href: string
  label: string
  icon: ComponentType<SVGProps<SVGSVGElement>>
  roles: Role[]
  /** Affiche le compteur de notifications non lues. */
  badge?: 'notifications'
}

export type NavSection = {
  title: string
  items: NavItem[]
}

const ALL: Role[] = ['ADMIN', 'MEMBER']
const STAFF: Role[] = ['ADMIN']

export const NAV_SECTIONS: NavSection[] = [
  {
    title: 'Espace de travail',
    items: [
      { href: '/dashboard', label: 'Tableau de bord', icon: IconDashboard, roles: ALL },
      { href: '/programme', label: 'Programme', icon: IconCalendar, roles: ALL },
      { href: '/modules', label: 'Modules', icon: IconBook, roles: ALL },
      { href: '/ressources', label: 'Ressources', icon: IconFolder, roles: ALL },
      { href: '/recherche', label: 'Recherche', icon: IconSearch, roles: ALL },
    ],
  },
  {
    title: 'Suivi',
    items: [
      { href: '/projets', label: 'Projets', icon: IconProject, roles: ALL },
      { href: '/echeances', label: 'Echeances', icon: IconClock, roles: ALL },
      { href: '/annonces', label: 'Annonces', icon: IconMegaphone, roles: ALL },
      { href: '/sondages', label: 'Sondages', icon: IconPoll, roles: ALL },
    ],
  },
  {
    title: 'Echanges',
    items: [
      {
        href: '/notifications',
        label: 'Notifications',
        icon: IconBell,
        roles: ALL,
        badge: 'notifications',
      },
      { href: '/reclamations', label: 'Reclamations', icon: IconComplaint, roles: ALL },
      { href: '/membres', label: 'Membres', icon: IconUsers, roles: ALL },
    ],
  },
]

/** Reserve au delegue : administration de SA classe, jamais de la plateforme. */
export const ADMIN_SECTION: NavSection = {
  title: 'Administration',
  items: [
    { href: '/admin', label: 'Vue generale', icon: IconShield, roles: STAFF },
    { href: '/admin/membres', label: 'Membres et invitations', icon: IconUsers, roles: STAFF },
    { href: '/admin/parametres', label: 'Parametres de la classe', icon: IconBuilding, roles: STAFF },
    { href: '/admin/annees', label: 'Annees et semestres', icon: IconLayers, roles: STAFF },
    { href: '/admin/archives', label: 'Archives', icon: IconArchive, roles: STAFF },
    { href: '/admin/statistiques', label: 'Statistiques', icon: IconActivity, roles: STAFF },
    { href: '/admin/audit', label: "Journal d'audit", icon: IconShield, roles: STAFF },
  ],
}

/** Sections visibles pour un role donne, vidées de leurs entrees interdites. */
export function navForRole(role: Role): NavSection[] {
  const sections = NAV_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => item.roles.includes(role)),
  })).filter((section) => section.items.length > 0)

  if (role === 'ADMIN') sections.push(ADMIN_SECTION)
  return sections
}

export const CLASSES_ITEM: NavItem = {
  href: '/classes',
  label: 'Mes classes',
  icon: IconGraduation,
  roles: ALL,
}

/** Entrees de la barre de navigation mobile (les 5 usages les plus frequents). */
export const MOBILE_NAV: NavItem[] = [
  { href: '/dashboard', label: 'Accueil', icon: IconDashboard, roles: ALL },
  { href: '/programme', label: 'Programme', icon: IconCalendar, roles: ALL },
  { href: '/ressources', label: 'Ressources', icon: IconFolder, roles: ALL },
  { href: '/echeances', label: 'Echeances', icon: IconClock, roles: ALL },
  {
    href: '/notifications',
    label: 'Alertes',
    icon: IconBell,
    roles: ALL,
    badge: 'notifications',
  },
]
