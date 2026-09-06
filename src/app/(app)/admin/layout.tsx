import type { ReactNode } from 'react'
import { requirePageClassAdmin } from '@/lib/auth/guards'

/**
 * Verrou de section : toute page sous /admin exige d'etre delegue de la
 * classe active. Un etudiant qui devine l'URL est renvoye au tableau de
 * bord, et chaque page refait de toute facon son propre controle.
 */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  await requirePageClassAdmin()
  return <>{children}</>
}
