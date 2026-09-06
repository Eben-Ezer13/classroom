import 'server-only'
import { prisma } from '@/lib/db'
import type { Prisma } from '@prisma/client'
import { PAGE_SIZE } from '@/lib/constants'

/**
 * Lecture paginee des ressources.
 * Aucune requete ne charge la table entiere : on renvoie toujours une page
 * bornee accompagnee du total, calcules dans une seule transaction.
 */

export type ResourceFilters = {
  q?: string
  moduleId?: string
  semesterId?: string
  kind?: string
  from?: string
  to?: string
  page: number
  includeArchived?: boolean
}

function buildWhere(
  classGroupId: string,
  filters: ResourceFilters,
): Prisma.ResourceWhereInput {
  const where: Prisma.ResourceWhereInput = {
    classGroupId,
    deletedAt: null,
  }

  if (!filters.includeArchived) where.isArchived = false
  if (filters.moduleId) where.moduleId = filters.moduleId
  if (filters.semesterId) where.semesterId = filters.semesterId
  if (filters.kind) where.kind = filters.kind as Prisma.EnumResourceKindFilter['equals']

  if (filters.q) {
    where.OR = [
      { title: { contains: filters.q, mode: 'insensitive' } },
      { description: { contains: filters.q, mode: 'insensitive' } },
      { fileName: { contains: filters.q, mode: 'insensitive' } },
      { module: { name: { contains: filters.q, mode: 'insensitive' } } },
      { module: { code: { contains: filters.q, mode: 'insensitive' } } },
    ]
  }

  const createdAt: Prisma.DateTimeFilter = {}
  if (filters.from && !Number.isNaN(Date.parse(filters.from))) {
    createdAt.gte = new Date(filters.from)
  }
  if (filters.to && !Number.isNaN(Date.parse(filters.to))) {
    const to = new Date(filters.to)
    to.setHours(23, 59, 59, 999)
    createdAt.lte = to
  }
  if (createdAt.gte || createdAt.lte) where.createdAt = createdAt

  return where
}

export async function listResources(classGroupId: string, filters: ResourceFilters) {
  const where = buildWhere(classGroupId, filters)
  const page = Math.max(1, filters.page)

  const [items, total] = await prisma.$transaction([
    prisma.resource.findMany({
      where,
      select: {
        id: true,
        title: true,
        description: true,
        kind: true,
        fileName: true,
        fileSize: true,
        mimeType: true,
        downloadCount: true,
        isArchived: true,
        createdAt: true,
        moduleId: true,
        module: { select: { id: true, code: true, name: true } },
        semester: { select: { label: true } },
        uploadedBy: { select: { firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.resource.count({ where }),
  ])

  return {
    items,
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)),
  }
}

/** Ressources d'un module, regroupees par type pour la page module. */
export async function listModuleResources(moduleId: string) {
  return prisma.resource.findMany({
    where: { moduleId, deletedAt: null, isArchived: false },
    select: {
      id: true,
      title: true,
      description: true,
      kind: true,
      fileSize: true,
      downloadCount: true,
      createdAt: true,
      module: { select: { code: true, name: true } },
      uploadedBy: { select: { firstName: true, lastName: true } },
    },
    orderBy: { createdAt: 'desc' },
  })
}

/** Statistiques de telechargement (page statistiques admin). */
export async function topDownloadedResources(classGroupId: string | null, take = 8) {
  return prisma.resource.findMany({
    where: {
      deletedAt: null,
      ...(classGroupId ? { classGroupId } : {}),
      downloadCount: { gt: 0 },
    },
    select: {
      id: true,
      title: true,
      kind: true,
      downloadCount: true,
      module: { select: { code: true } },
      classGroup: { select: { name: true } },
    },
    orderBy: { downloadCount: 'desc' },
    take,
  })
}
