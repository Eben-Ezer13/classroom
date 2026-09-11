import type { ReactNode } from 'react'
import { requirePageUser } from '@/lib/auth/guards'
import { unreadCount } from '@/lib/notifications'
import { env } from '@/lib/env'
import { AppShell } from '@/components/layout/app-shell'
import { logoutAction } from '@/app/actions/auth'
import { switchClassAction } from '@/app/actions/classes'
import { PresenceHeartbeat } from '@/components/features/presence-heartbeat'
import { UploadConfigProvider } from '@/components/features/direct-upload'

/**
 * Toutes les pages de ce groupe sont rendues a la demande : elles dependent
 * de la session et de donnees qui changent en permanence.
 */
export const dynamic = 'force-dynamic'

export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await requirePageUser()
  // Le compteur est borne a la classe ouverte : un membre de plusieurs
  // classes ne voit pas remonter les alertes d'un autre espace.
  const unread = await unreadCount(user.id, user.classGroupId)

  return (
    <UploadConfigProvider
      value={{
        // Vercel Blob : le navigateur envoie les fichiers directement au
        // stockage (les fonctions Vercel refusent les requetes > 4,5 Mo).
        mode: env.storageDriver === 'vercel-blob' ? 'direct' : 'server',
        access: env.blobAccess,
        userId: user.id,
        classGroupId: user.classGroupId,
      }}
    >
      <AppShell
        user={{
          id: user.id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          role: user.role,
          avatarUrl: user.avatarUrl,
          activeClassId: user.classGroupId,
          className: user.className,
          schoolName: user.schoolName,
          levelName: user.levelName,
          programName: user.programName,
          classes: user.memberships.map((m) => ({
            classGroupId: m.classGroupId,
            className: m.className,
            schoolName: m.schoolName,
            role: m.role,
          })),
        }}
        unreadCount={unread}
        logout={logoutAction}
        switchClass={switchClassAction}
      >
        <PresenceHeartbeat />
        {children}
      </AppShell>
    </UploadConfigProvider>
  )
}
