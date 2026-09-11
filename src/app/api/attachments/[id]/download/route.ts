import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth/session'
import { canManageClass } from '@/lib/permissions'
import { streamStoredFile } from '@/lib/storage/response'

export const maxDuration = 300

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

  return streamStoredFile(attachment, { disposition: 'attachment', logLabel: 'attachment' })
}
