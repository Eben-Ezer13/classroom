import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth/session'
import { canViewClass } from '@/lib/permissions'
import { streamStoredFile } from '@/lib/storage/response'

/** Un gros fichier sur une connexion lente : on laisse le temps au flux. */
export const maxDuration = 300

/**
 * Telechargement d'une ressource.
 *
 * Point unique d'acces aux fichiers : l'URL de stockage n'est jamais exposee
 * au navigateur. On verifie ici, dans l'ordre :
 *   1. l'utilisateur est authentifie ;
 *   2. la ressource existe et n'est pas supprimee ;
 *   3. elle appartient a SA classe (sinon 404, pas 403 : on ne revele meme
 *      pas l'existence de la ressource d'une autre classe).
 * Changer l'identifiant dans l'URL ne donne donc acces a rien.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: 'Authentification requise.' }, { status: 401 })
  }

  const { id } = await params

  const resource = await prisma.resource.findFirst({
    where: { id, deletedAt: null },
    select: {
      id: true,
      classGroupId: true,
      fileName: true,
      filePath: true,
      mimeType: true,
    },
  })

  if (!resource || !canViewClass(user, resource.classGroupId)) {
    return NextResponse.json({ error: 'Ressource introuvable.' }, { status: 404 })
  }

  const response = await streamStoredFile(resource, {
    disposition: 'attachment',
    logLabel: 'download',
  })

  // Compteur et historique : utilises par les statistiques. Un echec ici
  // ne doit pas empecher le telechargement.
  if (response.ok) {
    prisma
      .$transaction([
        prisma.resource.update({
          where: { id: resource.id },
          data: { downloadCount: { increment: 1 } },
        }),
        prisma.download.create({
          data: { resourceId: resource.id, userId: user.id },
        }),
      ])
      .catch((error) => console.error('[download] compteur non mis à jour', error))
  }

  return response
}
