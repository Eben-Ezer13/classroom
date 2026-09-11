import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth/session'
import { streamStoredFile } from '@/lib/storage/response'
import { AVATAR_RULE, checkFile } from '@/lib/uploads'

/**
 * Photo de profil.
 *
 * Servie par l'application et non en statique : le fichier stocke reste
 * inaccessible sans session. Une photo n'est visible que par les membres
 * d'une classe COMMUNE au demandeur et a la personne affichee (ou par
 * l'interesse lui-meme). Connaitre un identifiant d'utilisateur ne suffit
 * donc pas a recuperer sa photo.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const viewer = await getCurrentUser()
  if (!viewer) {
    return NextResponse.json({ error: 'Authentification requise.' }, { status: 401 })
  }

  const { id } = await params

  const viewerClassIds = viewer.memberships.map((m) => m.classGroupId)

  const target = await prisma.user.findFirst({
    where: {
      id,
      deletedAt: null,
      ...(viewer.id === id
        ? {}
        : {
            memberships: {
              some: { isActive: true, classGroupId: { in: viewerClassIds } },
            },
          }),
    },
    select: { id: true, avatarUrl: true },
  })

  if (!target?.avatarUrl) {
    return NextResponse.json({ error: 'Introuvable.' }, { status: 404 })
  }

  // Le type MIME est deduit de l'extension conservee a l'upload : seuls
  // PNG, JPEG et WEBP sont acceptes pour une photo.
  const check = checkFile({ name: target.avatarUrl, size: 1 }, AVATAR_RULE)
  const mimeType = check.ok ? check.mimeType : 'image/jpeg'

  return streamStoredFile(
    { filePath: target.avatarUrl, fileName: 'avatar', mimeType },
    { disposition: 'inline', cacheControl: 'private, max-age=300', logLabel: 'avatar' },
  )
}
