import type { Metadata } from 'next'
import Link from 'next/link'
import { requirePageUser } from '@/lib/auth/guards'
import { prisma } from '@/lib/db'
import { getDeadlineBuckets } from '@/lib/services/dashboard'
import { getClassModules } from '@/lib/services/class-context'
import { PageHeader } from '@/components/layout/page-header'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { EmptyState, StatTile } from '@/components/ui/feedback'
import { NoClassState } from '@/components/ui/no-class'
import { DeadlineItem } from '@/components/features/deadline-item'
import { IconClock } from '@/components/ui/icons'
import { cn, endOfDay } from '@/lib/utils'
import { AddDeadlineButton, DeadlineActions } from './deadline-controls'
import type { Prisma } from '@prisma/client'

export const metadata: Metadata = { title: 'Echeances' }

const VIEWS = [
  { key: 'a-venir', label: 'A venir' },
  { key: 'semaine', label: 'Cette semaine' },
  { key: 'mois', label: 'Ce mois' },
  { key: 'depassees', label: 'Depassees' },
] as const

export default async function DeadlinesPage({
  searchParams,
}: {
  searchParams: Promise<{ vue?: string; nouveau?: string }>
}) {
  const user = await requirePageUser()
  const params = await searchParams

  if (!user.classGroupId) {
    return (
      <>
        <PageHeader title="Echeances" />
        <NoClassState />
      </>
    )
  }

  // Seul le delegue de la classe active peut gerer le contenu.
  const canManage = user.role === 'ADMIN'
  const view = VIEWS.find((v) => v.key === params.vue)?.key ?? 'a-venir'
  const now = new Date()

  const dueFilter: Prisma.DateTimeFilter =
    view === 'depassees'
      ? { lt: now }
      : view === 'semaine'
        ? { gte: now, lte: new Date(now.getTime() + 7 * 86_400_000) }
        : view === 'mois'
          ? { gte: now, lte: new Date(now.getTime() + 30 * 86_400_000) }
          : { gte: now }

  const [deadlines, buckets, modules] = await Promise.all([
    prisma.deadline.findMany({
      where: { classGroupId: user.classGroupId, deletedAt: null, dueAt: dueFilter },
      select: {
        id: true,
        title: true,
        description: true,
        category: true,
        dueAt: true,
        reminderAt: true,
        moduleId: true,
        projectId: true,
        module: { select: { code: true, name: true } },
      },
      orderBy: { dueAt: view === 'depassees' ? 'desc' : 'asc' },
      take: 100,
    }),
    getDeadlineBuckets(user.classGroupId),
    getClassModules(user.classGroupId),
  ])

  const moduleOptions = modules.map((m) => ({ id: m.id, code: m.code, name: m.name }))
  const endToday = endOfDay(now).getTime()
  const todayItems = deadlines.filter(
    (d) => d.dueAt.getTime() >= now.getTime() && d.dueAt.getTime() <= endToday,
  )

  return (
    <>
      <PageHeader
        title="Echeances"
        description="Examens, devoirs, projets et rapports a rendre."
        actions={
          canManage ? (
            <AddDeadlineButton modules={moduleOptions} autoOpen={params.nouveau === '1'} />
          ) : null
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <StatTile label="Aujourd hui" value={buckets.today} tone="danger" />
        <StatTile label="Cette semaine" value={buckets.week} tone="warning" />
        <StatTile label="Ce mois" value={buckets.month} tone="info" />
        <StatTile
          label="Depassees"
          value={buckets.overdue}
          tone={buckets.overdue > 0 ? 'danger' : 'neutral'}
        />
      </div>

      <div className="flex items-center gap-1 mb-4 overflow-x-auto pb-1">
        {VIEWS.map((v) => (
          <Link
            key={v.key}
            href={v.key === 'a-venir' ? '/echeances' : `/echeances?vue=${v.key}`}
            className={cn(
              'shrink-0 rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors',
              v.key === view
                ? 'bg-[var(--accent-soft)] text-[var(--accent-strong)]'
                : 'text-[var(--text-2)] hover:bg-[var(--surface-3)]',
            )}
          >
            {v.label}
          </Link>
        ))}
      </div>

      {view === 'a-venir' && todayItems.length > 0 ? (
        <Card className="mb-4 border-[var(--danger-border)]">
          <CardHeader
            title="A rendre aujourd hui"
            description={`${todayItems.length} echeance(s) dans la journee`}
          />
          <CardBody className="space-y-2.5">
            {todayItems.map((deadline) => (
              <DeadlineItem key={deadline.id} deadline={deadline} />
            ))}
          </CardBody>
        </Card>
      ) : null}

      <Card>
        {deadlines.length === 0 ? (
          <EmptyState
            icon={<IconClock />}
            title="Aucune echeance"
            description={
              view === 'depassees'
                ? 'Aucune echeance depassee. Tout est a jour.'
                : canManage
                  ? 'Ajoutez une echeance pour prevenir la classe.'
                  : 'Rien a rendre sur cette periode.'
            }
          />
        ) : (
          <CardBody className="space-y-2.5">
            {deadlines.map((deadline) => (
              <DeadlineItem
                key={deadline.id}
                deadline={deadline}
                actions={
                  canManage ? (
                    <DeadlineActions
                      deadline={{
                        id: deadline.id,
                        title: deadline.title,
                        description: deadline.description,
                        category: deadline.category,
                        dueAt: deadline.dueAt,
                        reminderAt: deadline.reminderAt,
                        moduleId: deadline.moduleId,
                      }}
                      modules={moduleOptions}
                    />
                  ) : null
                }
              />
            ))}
          </CardBody>
        )}
      </Card>
    </>
  )
}
