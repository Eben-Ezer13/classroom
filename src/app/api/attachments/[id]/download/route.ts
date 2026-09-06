import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth/session'
import { canManageClass } from '@/lib/permissions'
import { readFile } from '@/lib/storage'

/**
 * Piece jointe d'une reclamation.
 * Meme regle que la reclamation elle-meme : seuls son auteur et les
 * responsables de sa classe peuvent la telecharger.
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

  const attachment = await prisma.attachment.findUnique({
    where: { id },
    select: {
      fileName: true,
      filePath: true,
      mimeType: true,
      complaint: {
        select: { id: true, authorId: true, classGroupId: true, deletedAt: true },
      },
    },
  })

  const complaint = attachment?.complaint
  const allowed =
    attachment &&
    complaint &&
    !complaint.deletedAt &&
    (complaint.authorId === user.id || canManageClass(user, complaint.classGroupId))

  if (!allowed) {
    return NextResponse.json({ error: 'Fichier introuvable.' }, { status: 404 })
  }

  let data: Buffer
  try {
    data = await readFile(attachment.filePath)
  } catch {
    return NextResponse.json({ error: 'Fichier indisponible.' }, { status: 502 })
  }

  const asciiName = attachment.fileName.replace(/[^\x20-\x7e]/g, '_')

  return new NextResponse(new Uint8Array(data), {
    headers: {
      'Content-Type': attachment.mimeType || 'application/octet-stream',
      'Content-Length': String(data.byteLength),
      'Content-Disposition': `attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(attachment.fileName)}`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
