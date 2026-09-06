import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth/session'
import { canViewClass } from '@/lib/permissions'
import { readFile } from '@/lib/storage'

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
      fileSize: true,
    },
  })

  if (!resource || !canViewClass(user, resource.classGroupId)) {
    return NextResponse.json({ error: 'Ressource introuvable.' }, { status: 404 })
  }

  let data: Buffer
  try {
    data = await readFile(resource.filePath)
  } catch (error) {
    console.error('[download] fichier illisible', resource.id, error)
    return NextResponse.json(
      { error: 'Fichier indisponible dans le stockage.' },
      { status: 502 },
    )
  }

  // Compteur et historique : utilises par les statistiques. Un echec ici
  // ne doit pas empecher le telechargement.
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
    .catch((error) => console.error('[download] compteur non mis a jour', error))

  const asciiName = resource.fileName.replace(/[^\x20-\x7e]/g, '_')

  return new NextResponse(new Uint8Array(data), {
    headers: {
      'Content-Type': resource.mimeType || 'application/octet-stream',
      'Content-Length': String(data.byteLength),
      'Content-Disposition': `attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(resource.fileName)}`,
      // Un fichier academique ne doit pas etre mis en cache par un proxy
      // partage : il est servi sous condition de permission.
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
