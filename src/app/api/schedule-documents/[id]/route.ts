import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth/session'
import { canViewClass } from '@/lib/permissions'
import { streamStoredFile } from '@/lib/storage/response'

export const maxDuration = 300

/**
 * Emploi du temps televerse (image ou PDF).
 *
 * Meme regle que les ressources : le fichier n'est jamais servi depuis une
 * URL de stockage, mais relaye par cette route apres verification de
 * l'appartenance a la classe. `?telecharger=1` force l'enregistrement,
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

  const download = new URL(request.url).searchParams.get('telecharger') === '1'

  return streamStoredFile(document, {
    disposition: download ? 'attachment' : 'inline',
    logLabel: 'schedule-document',
  })
}
