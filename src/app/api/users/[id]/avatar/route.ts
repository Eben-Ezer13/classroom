import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth/session'
import { readFile } from '@/lib/storage'

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

  // Le type MIME est deduit de l extension conservee a l upload : seuls
  // PNG, JPEG et WEBP sont acceptes par assertValidAvatar.
  const lower = target.avatarUrl.toLowerCase()
  const contentType = lower.endsWith('.png')
    ? 'image/png'
    : lower.endsWith('.webp')
      ? 'image/webp'
      : 'image/jpeg'

  try {
    const data = await readFile(target.avatarUrl)
    return new NextResponse(new Uint8Array(data), {
      headers: {
        'Content-Type': contentType,
        'Content-Length': String(data.byteLength),
        'Cache-Control': 'private, max-age=300',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch {
    return NextResponse.json({ error: 'Introuvable.' }, { status: 404 })
  }
}
