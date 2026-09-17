import type { Metadata } from 'next'
import { requirePageUser } from '@/lib/auth/guards'
import { prisma } from '@/lib/db'
import { getClassModules } from '@/lib/services/class-context'
import { listClassMembers } from '@/lib/services/classes'
import { PageHeader } from '@/components/layout/page-header'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/feedback'
import { Pagination } from '@/components/ui/pagination'
import { Input, Select } from '@/components/ui/field'
import { NoClassState } from '@/components/ui/no-class'
import { FilterBar, FilterField } from '@/components/features/filter-bar'
import { AnnouncementCard } from '@/components/features/announcement-card'
import { IconMegaphone } from '@/components/ui/icons'
import {
  ANNOUNCEMENT_CATEGORY_LABELS,
  ANNOUNCEMENT_LEVEL_LABELS,
  PAGE_SIZE,
  isLabelKey,
} from '@/lib/constants'
import { normalizeSearch } from '@/lib/utils'
import { AddAnnouncementButton, AnnouncementActions } from './announcement-controls'
import type { Prisma } from '@prisma/client'

export const metadata: Metadata = { title: 'Annonces' }

export default async function AnnouncementsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>
}) {
  const user = await requirePageUser()
  const raw = await searchParams

  if (!user.classGroupId) {
    return (
      <>
        <PageHeader title="Annonces" />
        <NoClassState />
      </>
    )
  }

  // Seul le delegue de la classe active peut gerer le contenu.
  const canManage = user.role === 'ADMIN'
  const q = normalizeSearch(raw.q)
  const level = isLabelKey(ANNOUNCEMENT_LEVEL_LABELS, raw.level) ? raw.level : undefined
  const category = isLabelKey(ANNOUNCEMENT_CATEGORY_LABELS, raw.category)
    ? raw.category
    : undefined
  const moduleId = raw.moduleId || undefined
  const pageRaw = Number(raw.page ?? '1')
  const page = Number.isFinite(pageRaw) ? Math.max(1, Math.floor(pageRaw)) : 1
  const now = new Date()

  // Les conditions sont empilees dans un AND : deux filtres qui utilisent
  // chacun un OR (recherche plein texte et fenetre de publication) ne
  // peuvent alors pas s ecraser mutuellement.
  const conditions: Prisma.AnnouncementWhereInput[] = []

  if (level) conditions.push({ level: level as Prisma.EnumAnnouncementLevelFilter['equals'] })
  if (category) {
    conditions.push({
      category: category as Prisma.EnumAnnouncementCategoryFilter['equals'],
    })
  }
  if (moduleId) conditions.push({ moduleId })
  if (q) {
    conditions.push({
      OR: [
        { title: { contains: q, mode: 'insensitive' } },
        { content: { contains: q, mode: 'insensitive' } },
      ],
    })
  }
  // Les etudiants ne voient ni les annonces programmees ni les expirees ;
  // le delegue si, pour pouvoir les prolonger ou les supprimer.
  if (!canManage) {
    conditions.push({ publishedAt: { lte: now } })
    conditions.push({ OR: [{ expiresAt: null }, { expiresAt: { gte: now } }] })
  }

  const where: Prisma.AnnouncementWhereInput = {
    classGroupId: user.classGroupId,
    deletedAt: null,
    ...(conditions.length > 0 ? { AND: conditions } : {}),
  }

  const [items, total, modules, members] = await Promise.all([
    prisma.announcement.findMany({
      where,
      select: {
        id: true,
        title: true,
        content: true,
        level: true,
        category: true,
        isPinned: true,
        publishedAt: true,
        expiresAt: true,
        moduleId: true,
        mentionsAll: true,
        mentions: {
          select: { userId: true, user: { select: { firstName: true, lastName: true } } },
        },
        module: { select: { code: true, name: true } },
        author: { select: { firstName: true, lastName: true } },
      },
      orderBy: [{ isPinned: 'desc' }, { publishedAt: 'desc' }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.announcement.count({ where }),
    getClassModules(user.classGroupId),
    canManage ? listClassMembers(user.classGroupId) : Promise.resolve([]),
  ])

  const moduleOptions = modules.map((m) => ({ id: m.id, code: m.code, name: m.name }))
  const memberOptions = members
    .filter((m) => m.userId !== user.id)
    .map((m) => ({ id: m.userId, name: `${m.firstName} ${m.lastName}` }))
  const hasFilters = Boolean(q || level || category || moduleId)

  return (
    <>
      <PageHeader
        title="Annonces"
        description="Informations, changements de salle et événements de la classe."
        actions={
          canManage ? (
            <AddAnnouncementButton
              modules={moduleOptions}
              members={memberOptions}
              autoOpen={raw.nouveau === '1'}
            />
          ) : null
        }
      />

      <FilterBar action="/annonces" hasFilters={hasFilters}>
        <FilterField label="Recherche" htmlFor="q" className="min-w-[200px] flex-[2]">
          <Input id="q" name="q" defaultValue={q} placeholder="Titre ou contenu..." />
        </FilterField>
        <FilterField label="Niveau" htmlFor="level">
          <Select id="level" name="level" defaultValue={level ?? ''}>
            <option value="">Tous</option>
            {Object.entries(ANNOUNCEMENT_LEVEL_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </FilterField>
        <FilterField label="Catégorie" htmlFor="category">
          <Select id="category" name="category" defaultValue={category ?? ''}>
            <option value="">Toutes</option>
            {Object.entries(ANNOUNCEMENT_CATEGORY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </FilterField>
        <FilterField label="Module" htmlFor="moduleId">
          <Select id="moduleId" name="moduleId" defaultValue={moduleId ?? ''}>
            <option value="">Tous</option>
            {modules.map((m) => (
              <option key={m.id} value={m.id}>
                {m.code}
              </option>
            ))}
          </Select>
        </FilterField>
      </FilterBar>

      {items.length === 0 ? (
        <Card>
          <EmptyState
            icon={<IconMegaphone />}
            title={hasFilters ? 'Aucun résultat' : 'Aucune annonce'}
            description={
              hasFilters
                ? 'Aucune annonce ne correspond à ces filtres.'
                : canManage
                  ? 'Publiez la première annonce de la classe.'
                  : 'Les annonces du délégué apparaîtront ici.'
            }
          />
        </Card>
      ) : (
        <Card>
          <div className="p-3.5 space-y-3">
            {items.map((announcement) => (
              <AnnouncementCard
                key={announcement.id}
                announcement={announcement}
                currentUserId={user.id}
                actions={
                  canManage ? (
                    <AnnouncementActions
                      announcement={{
                        id: announcement.id,
                        title: announcement.title,
                        content: announcement.content,
                        level: announcement.level,
                        category: announcement.category,
                        isPinned: announcement.isPinned,
                        moduleId: announcement.moduleId,
                        expiresAt: announcement.expiresAt,
                        mentionsAll: announcement.mentionsAll,
                        mentionedUserIds: announcement.mentions.map((m) => m.userId),
                      }}
                      modules={moduleOptions}
                      members={memberOptions}
                    />
                  ) : null
                }
              />
            ))}
          </div>
          <Pagination
            page={page}
            pageCount={Math.max(1, Math.ceil(total / PAGE_SIZE))}
            total={total}
            basePath="/annonces"
            params={{ q: q || undefined, level, category, moduleId }}
          />
        </Card>
      )}
    </>
  )
}
