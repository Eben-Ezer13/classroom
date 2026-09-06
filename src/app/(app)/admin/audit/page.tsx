import type { Metadata } from 'next'
import { prisma } from '@/lib/db'
import { requirePageClassAdmin } from '@/lib/auth/guards'
import { PageHeader } from '@/components/layout/page-header'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/feedback'
import { Pagination } from '@/components/ui/pagination'
import { Badge } from '@/components/ui/badge'
import { Input, Select } from '@/components/ui/field'
import { FilterBar, FilterField } from '@/components/features/filter-bar'
import { IconShield } from '@/components/ui/icons'
import { PAGE_SIZE } from '@/lib/constants'
import { formatDateTime, normalizeSearch } from '@/lib/utils'
import type { Prisma } from '@prisma/client'

export const metadata: Metadata = { title: "Journal d'audit" }

const ENTITY_TYPES = [
  'Resource',
  'Announcement',
  'ScheduleEntry',
  'Deadline',
  'Project',
  'Poll',
  'Complaint',
  'Module',
  'Membership',
  'Invitation',
  'ScheduleDocument',
  'ClassGroup',
  'AcademicYear',
  'Semester',
]

export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>
}) {
  // Le journal est celui de MA classe : le filtre sur classGroupId est
  // pose par le serveur, il n'est pas modifiable depuis l'URL.
  const { classId } = await requirePageClassAdmin()
  const raw = await searchParams
  const q = normalizeSearch(raw.q)
  const entityType = raw.entityType && ENTITY_TYPES.includes(raw.entityType) ? raw.entityType : undefined
  const pageRaw = Number(raw.page ?? '1')
  const page = Number.isFinite(pageRaw) ? Math.max(1, Math.floor(pageRaw)) : 1

  const conditions: Prisma.AuditLogWhereInput[] = [{ classGroupId: classId }]
  if (entityType) conditions.push({ entityType })
  if (q) {
    conditions.push({
      OR: [
        { summary: { contains: q, mode: 'insensitive' } },
        { actorLabel: { contains: q, mode: 'insensitive' } },
        { action: { contains: q, mode: 'insensitive' } },
        { entityLabel: { contains: q, mode: 'insensitive' } },
      ],
    })
  }

  const where: Prisma.AuditLogWhereInput = { AND: conditions }

  const [entries, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      select: {
        id: true,
        actorLabel: true,
        action: true,
        entityType: true,
        entityLabel: true,
        summary: true,
        ip: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.auditLog.count({ where }),
  ])

  return (
    <>
      <PageHeader
        title="Journal d'audit"
        description="Actions sensibles effectuees dans votre classe, avec auteur et horodatage."
        breadcrumb={[{ label: 'Administration', href: '/admin' }, { label: 'Audit' }]}
      />

      <FilterBar action="/admin/audit" hasFilters={Boolean(q || entityType)}>
        <FilterField label="Recherche" htmlFor="q" className="min-w-[200px] flex-[2]">
          <Input id="q" name="q" defaultValue={q} placeholder="Auteur, action, objet..." />
        </FilterField>
        <FilterField label="Type d objet" htmlFor="entityType">
          <Select id="entityType" name="entityType" defaultValue={entityType ?? ''}>
            <option value="">Tous</option>
            {ENTITY_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </Select>
        </FilterField>
      </FilterBar>

      <Card>
        {entries.length === 0 ? (
          <EmptyState
            icon={<IconShield />}
            title="Aucune entrée"
            description="Aucune action ne correspond a ces filtres."
          />
        ) : (
          <>
            <ul className="divide-y divide-[var(--border)]">
              {entries.map((entry) => (
                <li key={entry.id} className="flex items-start gap-3 p-4">
                  <Badge className="shrink-0 mt-0.5">{entry.entityType}</Badge>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13.5px] text-[var(--text-1)] leading-relaxed">
                      {entry.summary}
                    </p>
                    <p className="mt-1 text-[12px] text-[var(--text-3)]">
                      {formatDateTime(entry.createdAt)}
                      {' · '}
                      {entry.action}
                      {entry.ip ? ` · ${entry.ip}` : ''}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
            <Pagination
              page={page}
              pageCount={Math.max(1, Math.ceil(total / PAGE_SIZE))}
              total={total}
              basePath="/admin/audit"
              params={{ q: q || undefined, entityType }}
            />
          </>
        )}
      </Card>
    </>
  )
}
