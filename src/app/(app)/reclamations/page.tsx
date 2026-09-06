import type { Metadata } from 'next'
import Link from 'next/link'
import { requirePageUser } from '@/lib/auth/guards'
import { listComplaints } from '@/lib/services/complaints'
import { PageHeader } from '@/components/layout/page-header'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/feedback'
import { Pagination } from '@/components/ui/pagination'
import { Badge, toTone } from '@/components/ui/badge'
import { Avatar } from '@/components/ui/avatar'
import { Select } from '@/components/ui/field'
import { NoClassState } from '@/components/ui/no-class'
import { FilterBar, FilterField } from '@/components/features/filter-bar'
import { IconComplaint } from '@/components/ui/icons'
import {
  COMPLAINT_CATEGORY_LABELS,
  COMPLAINT_PRIORITY_LABELS,
  COMPLAINT_PRIORITY_TONE,
  COMPLAINT_STATUS_LABELS,
  COMPLAINT_STATUS_TONE,
} from '@/lib/constants'
import { formatRelative } from '@/lib/utils'
import { AddComplaintButton } from './complaint-controls'

export const metadata: Metadata = { title: 'Réclamations' }

export default async function ComplaintsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>
}) {
  const user = await requirePageUser()
  const raw = await searchParams

  if (!user.classGroupId && user.role !== 'ADMIN') {
    return (
      <>
        <PageHeader title="Réclamations" />
        <NoClassState />
      </>
    )
  }

  // Seul le delegue de la classe active dispose des vues de gestion.
  const isStaff = user.role === 'ADMIN'
  const status = raw.status && raw.status in COMPLAINT_STATUS_LABELS ? raw.status : undefined
  const category =
    raw.category && raw.category in COMPLAINT_CATEGORY_LABELS ? raw.category : undefined
  const pageRaw = Number(raw.page ?? '1')
  const page = Number.isFinite(pageRaw) ? Math.max(1, Math.floor(pageRaw)) : 1

  const result = await listComplaints(user, { status, category, page })

  return (
    <>
      <PageHeader
        title="Réclamations"
        description={
          isStaff
            ? `Difficultés signalées par la classe. ${result.pending} en attente.`
            : 'Vos signalements. Seuls vous et les responsables de votre classe y ont accès.'
        }
        actions={
          user.classGroupId ? <AddComplaintButton autoOpen={raw.nouveau === '1'} /> : null
        }
      />

      <FilterBar action="/reclamations" hasFilters={Boolean(status || category)}>
        <FilterField label="Statut" htmlFor="status">
          <Select id="status" name="status" defaultValue={status ?? ''}>
            <option value="">Tous</option>
            {Object.entries(COMPLAINT_STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </FilterField>
        <FilterField label="Catégorie" htmlFor="category">
          <Select id="category" name="category" defaultValue={category ?? ''}>
            <option value="">Toutes</option>
            {Object.entries(COMPLAINT_CATEGORY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </FilterField>
      </FilterBar>

      <Card>
        {result.items.length === 0 ? (
          <EmptyState
            icon={<IconComplaint />}
            title={status || category ? 'Aucun resultat' : 'Aucune reclamation'}
            description={
              isStaff
                ? 'Aucune difficulte signalee pour le moment.'
                : 'Vous n avez encore signale aucune difficulte.'
            }
          />
        ) : (
          <>
            <ul className="divide-y divide-[var(--border)]">
              {result.items.map((complaint) => (
                <li key={complaint.id}>
                  <Link
                    href={`/reclamations/${complaint.id}`}
                    className="flex items-start gap-3 p-4 hover:bg-[var(--surface-2)] transition-colors"
                  >
                    <Avatar
                      firstName={complaint.author.firstName}
                      lastName={complaint.author.lastName}
                      src={
                        complaint.author.avatarUrl
                          ? `/api/users/${complaint.author.id}/avatar`
                          : null
                      }
                      size="md"
                    />

                    <div className="min-w-0 flex-1">
                      <p className="text-[14px] font-medium text-[var(--text-1)] leading-snug">
                        {complaint.title}
                      </p>
                      <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                        <Badge tone={toTone(COMPLAINT_STATUS_TONE[complaint.status])}>
                          {COMPLAINT_STATUS_LABELS[complaint.status]}
                        </Badge>
                        <Badge tone={toTone(COMPLAINT_PRIORITY_TONE[complaint.priority])}>
                          {COMPLAINT_PRIORITY_LABELS[complaint.priority]}
                        </Badge>
                        <Badge>{COMPLAINT_CATEGORY_LABELS[complaint.category]}</Badge>
                      </div>
                      <p className="mt-1.5 text-[12px] text-[var(--text-3)]">
                        {isStaff
                          ? `${complaint.author.firstName} ${complaint.author.lastName} · `
                          : ''}
                        {formatRelative(complaint.createdAt)}
                        {complaint._count.messages > 0
                          ? ` · ${complaint._count.messages} message(s)`
                          : ''}
                        {complaint._count.attachments > 0
                          ? ` · ${complaint._count.attachments} piece(s) jointe(s)`
                          : ''}
                      </p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
            <Pagination
              page={result.page}
              pageCount={result.pageCount}
              total={result.total}
              basePath="/reclamations"
              params={{ status, category }}
            />
          </>
        )}
      </Card>
    </>
  )
}
