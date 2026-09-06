import 'server-only'
import { prisma } from '@/lib/db'
import { canManageClass } from '@/lib/permissions'
import { NotFoundError } from '@/lib/errors'
import type { SessionUser } from '@/lib/auth/session'
import type { Prisma } from '@prisma/client'
import { PAGE_SIZE } from '@/lib/constants'

/**
 * Regle d'acces centrale des reclamations :
 *   - un etudiant ne voit QUE les siennes ;
 *   - un delegue voit celles de SA classe.
 * Toute lecture par identifiant passe par `loadComplaintFor`, et toute
 * liste par `complaintScope` : aucune reclamation ne franchit la frontiere
 * d'une classe.
 */

export async function loadComplaintFor(user: SessionUser, complaintId: string) {
  const complaint = await prisma.complaint.findFirst({
    where: { id: complaintId, deletedAt: null },
    select: {
      id: true,
      classGroupId: true,
      authorId: true,
      title: true,
      status: true,
    },
  })
  if (!complaint) throw new NotFoundError('Reclamation introuvable.')

  const isAuthor = complaint.authorId === user.id
  const isStaff = canManageClass(user, complaint.classGroupId)
  // 404 et non 403 : un etudiant ne doit pas pouvoir deduire l'existence
  // de la reclamation d'un camarade en testant des identifiants.
  if (!isAuthor && !isStaff) throw new NotFoundError('Reclamation introuvable.')

  return { complaint, isAuthor, isStaff }
}

/** Filtre de perimetre applique a toutes les listes de reclamations. */
export function complaintScope(user: SessionUser): Prisma.ComplaintWhereInput {
  const classGroupId = user.classGroupId ?? '__aucune_classe__'
  if (user.role === 'ADMIN') return { deletedAt: null, classGroupId }
  // Un etudiant ne voit que ses propres reclamations, dans sa classe active.
  return { deletedAt: null, classGroupId, authorId: user.id }
}

export async function listComplaints(
  user: SessionUser,
  options: { status?: string; category?: string; page: number },
) {
  const conditions: Prisma.ComplaintWhereInput[] = [complaintScope(user)]
  if (options.status) {
    conditions.push({ status: options.status as Prisma.EnumComplaintStatusFilter['equals'] })
  }
  if (options.category) {
    conditions.push({
      category: options.category as Prisma.EnumComplaintCategoryFilter['equals'],
    })
  }

  const where: Prisma.ComplaintWhereInput = { AND: conditions }
  const page = Math.max(1, options.page)

  const [items, total, pending] = await prisma.$transaction([
    prisma.complaint.findMany({
      where,
      select: {
        id: true,
        title: true,
        category: true,
        priority: true,
        status: true,
        createdAt: true,
        resolvedAt: true,
        author: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
        _count: { select: { messages: true, attachments: true } },
      },
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.complaint.count({ where }),
    prisma.complaint.count({ where: { AND: [complaintScope(user), { status: 'EN_ATTENTE' }] } }),
  ])

  return {
    items,
    total,
    pending,
    page,
    pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)),
  }
}

export async function getComplaintDetail(complaintId: string) {
  return prisma.complaint.findUnique({
    where: { id: complaintId },
    select: {
      id: true,
      title: true,
      description: true,
      category: true,
      priority: true,
      status: true,
      createdAt: true,
      resolvedAt: true,
      classGroupId: true,
      author: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
      assignedTo: { select: { firstName: true, lastName: true } },
      attachments: {
        select: { id: true, fileName: true, fileSize: true, mimeType: true },
        orderBy: { createdAt: 'asc' },
      },
      messages: {
        select: {
          id: true,
          body: true,
          createdAt: true,
          author: {
            select: { id: true, firstName: true, lastName: true, role: true, avatarUrl: true },
          },
        },
        orderBy: { createdAt: 'asc' },
      },
    },
  })
}
