import 'server-only'
import { prisma } from '@/lib/db'
import type { Prisma } from '@prisma/client'

/**
 * Recherche globale.
 *
 * Chaque entite est interrogee separement avec sa propre limite : on ne
 * charge jamais l'integralite d'une table, et le total par categorie permet
 * d'afficher une pagination par onglet.
 */

export type SearchScope = 'tout' | 'ressources' | 'modules' | 'projets' | 'annonces'

export type SearchFilters = {
  q: string
  scope: SearchScope
  moduleId?: string
  semesterId?: string
  kind?: string
  from?: string
  to?: string
  page: number
}

const PER_SCOPE = 10

function dateRange(from?: string, to?: string): Prisma.DateTimeFilter | undefined {
  const filter: Prisma.DateTimeFilter = {}
  if (from && !Number.isNaN(Date.parse(from))) filter.gte = new Date(from)
  if (to && !Number.isNaN(Date.parse(to))) {
    const end = new Date(to)
    end.setHours(23, 59, 59, 999)
    filter.lte = end
  }
  return filter.gte || filter.lte ? filter : undefined
}

export async function globalSearch(classGroupId: string, filters: SearchFilters) {
  const { q } = filters
  if (!q) {
    return {
      resources: { items: [], total: 0 },
      modules: { items: [], total: 0 },
      projects: { items: [], total: 0 },
      announcements: { items: [], total: 0 },
      total: 0,
    }
  }

  const created = dateRange(filters.from, filters.to)
  const wantAll = filters.scope === 'tout'
  const page = Math.max(1, filters.page)
  const skip = wantAll ? 0 : (page - 1) * PER_SCOPE
  const take = wantAll ? 5 : PER_SCOPE

  const resourceWhere: Prisma.ResourceWhereInput = {
    classGroupId,
    deletedAt: null,
    isArchived: false,
    ...(filters.moduleId ? { moduleId: filters.moduleId } : {}),
    ...(filters.semesterId ? { semesterId: filters.semesterId } : {}),
    ...(filters.kind ? { kind: filters.kind as Prisma.EnumResourceKindFilter['equals'] } : {}),
    ...(created ? { createdAt: created } : {}),
    OR: [
      { title: { contains: q, mode: 'insensitive' } },
      { description: { contains: q, mode: 'insensitive' } },
      { fileName: { contains: q, mode: 'insensitive' } },
    ],
  }

  const moduleWhere: Prisma.ModuleWhereInput = {
    classGroupId,
    deletedAt: null,
    ...(filters.semesterId ? { semesterId: filters.semesterId } : {}),
    OR: [
      { name: { contains: q, mode: 'insensitive' } },
      { code: { contains: q, mode: 'insensitive' } },
      { description: { contains: q, mode: 'insensitive' } },
      { teacherName: { contains: q, mode: 'insensitive' } },
    ],
  }

  const projectWhere: Prisma.ProjectWhereInput = {
    classGroupId,
    deletedAt: null,
    ...(filters.moduleId ? { moduleId: filters.moduleId } : {}),
    ...(filters.semesterId ? { semesterId: filters.semesterId } : {}),
    ...(created ? { createdAt: created } : {}),
    OR: [
      { title: { contains: q, mode: 'insensitive' } },
      { description: { contains: q, mode: 'insensitive' } },
      { instructions: { contains: q, mode: 'insensitive' } },
    ],
  }

  const announcementWhere: Prisma.AnnouncementWhereInput = {
    classGroupId,
    deletedAt: null,
    ...(filters.moduleId ? { moduleId: filters.moduleId } : {}),
    ...(created ? { createdAt: created } : {}),
    OR: [
      { title: { contains: q, mode: 'insensitive' } },
      { content: { contains: q, mode: 'insensitive' } },
    ],
  }

  const wantResources = wantAll || filters.scope === 'ressources'
  const wantModules = wantAll || filters.scope === 'modules'
  const wantProjects = wantAll || filters.scope === 'projets'
  const wantAnnouncements = wantAll || filters.scope === 'annonces'

  const [
    resourceItems,
    resourceTotal,
    moduleItems,
    moduleTotal,
    projectItems,
    projectTotal,
    announcementItems,
    announcementTotal,
  ] = await Promise.all([
    wantResources
      ? prisma.resource.findMany({
          where: resourceWhere,
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
          skip,
          take,
        })
      : Promise.resolve([]),
    wantResources ? prisma.resource.count({ where: resourceWhere }) : Promise.resolve(0),

    wantModules
      ? prisma.module.findMany({
          where: moduleWhere,
          select: {
            id: true,
            code: true,
            name: true,
            description: true,
            teacherName: true,
            color: true,
            semester: { select: { label: true } },
          },
          orderBy: { code: 'asc' },
          skip,
          take,
        })
      : Promise.resolve([]),
    wantModules ? prisma.module.count({ where: moduleWhere }) : Promise.resolve(0),

    wantProjects
      ? prisma.project.findMany({
          where: projectWhere,
          select: {
            id: true,
            title: true,
            description: true,
            dueAt: true,
            module: { select: { code: true } },
          },
          orderBy: { dueAt: 'asc' },
          skip,
          take,
        })
      : Promise.resolve([]),
    wantProjects ? prisma.project.count({ where: projectWhere }) : Promise.resolve(0),

    wantAnnouncements
      ? prisma.announcement.findMany({
          where: announcementWhere,
          select: {
            id: true,
            title: true,
            content: true,
            level: true,
            category: true,
            publishedAt: true,
            isPinned: true,
            module: { select: { code: true, name: true } },
            author: { select: { firstName: true, lastName: true } },
          },
          orderBy: { publishedAt: 'desc' },
          skip,
          take,
        })
      : Promise.resolve([]),
    wantAnnouncements
      ? prisma.announcement.count({ where: announcementWhere })
      : Promise.resolve(0),
  ])

  return {
    resources: { items: resourceItems, total: resourceTotal },
    modules: { items: moduleItems, total: moduleTotal },
    projects: { items: projectItems, total: projectTotal },
    announcements: { items: announcementItems, total: announcementTotal },
    total: resourceTotal + moduleTotal + projectTotal + announcementTotal,
    perPage: PER_SCOPE,
  }
}
