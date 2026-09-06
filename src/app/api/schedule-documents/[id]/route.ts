import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth/session'
import { canViewClass } from '@/lib/permissions'
import { readStream } from '@/lib/storage'

/**
 * Emploi du temps televerse (image ou PDF).
 *
 * Meme regle que les ressources : le fichier n'est jamais servi depuis une
 * URL de stockage devinable, mais relaye par cette route apres verification
 * de l'appartenance a la classe. `?telecharger=1` force l'enregistrement,
 * sinon le document s'affiche dans l'apercu.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: 'Authentification requise.' }, { status: 401 })
  }

  const { id } = await params

  const document = await prisma.scheduleDocument.findFirst({
    where: { id, deletedAt: null },
    select: {
      classGroupId: true,
      fileName: true,
      filePath: true,
      mimeType: true,
    },
  })

  // 404 et non 403 : on ne revele pas l'existence du document d'une autre
  // classe.
  if (!document || !canViewClass(user, document.classGroupId)) {
    return NextResponse.json({ error: 'Document introuvable.' }, { status: 404 })
  }

  let body: ReadableStream<Uint8Array>
  try {
    body = await readStream(document.filePath)
  } catch (error) {
    console.error('[schedule-document] fichier illisible', id, error)
    return NextResponse.json({ error: 'Fichier indisponible.' }, { status: 502 })
  }

  const download = new URL(request.url).searchParams.get('telecharger') === '1'
  const asciiName = document.fileName.replace(/[^\x20-\x7e]/g, '_')

  return new NextResponse(body, {
    headers: {
      'Content-Type': document.mimeType || 'application/octet-stream',
      'Content-Disposition': `${download ? 'attachment' : 'inline'}; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(document.fileName)}`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
