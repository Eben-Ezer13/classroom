import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requirePageUser } from '@/lib/auth/guards'
import { prisma } from '@/lib/db'
import { canViewClass } from '@/lib/permissions'
import { getClassModules, getClassSemesters, getDefaultSemesterId } from '@/lib/services/class-context'
import { PageHeader } from '@/components/layout/page-header'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/feedback'
import { Badge } from '@/components/ui/badge'
import { ResourceItem } from '@/components/features/resource-item'
import { ScheduleItem } from '@/components/features/schedule-item'
import { AnnouncementCard } from '@/components/features/announcement-card'
import { IconClock, IconFile, IconMegaphone, IconProject } from '@/components/ui/icons'
import { cn, formatCountdown, formatDateShort } from '@/lib/utils'
import { AddResourceButton } from '../../ressources/resource-controls'

type Props = {
  params: Promise<{ id: string }>
  searchParams: Promise<{ onglet?: string }>
}

const TABS = [
  { key: 'cours', label: 'Cours' },
  { key: 'td', label: 'TD' },
  { key: 'tp', label: 'TP' },
  { key: 'projets', label: 'Projets' },
  { key: 'examens', label: 'Examens' },
  { key: 'annonces', label: 'Annonces' },
] as const

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const mod = await prisma.module.findUnique({
    where: { id },
    select: { code: true, name: true },
  })
  return { title: mod ? `${mod.code} — ${mod.name}` : 'Module' }
}

export default async function ModuleDetailPage({ params, searchParams }: Props) {
  const user = await requirePageUser()
  const { id } = await params
  const { onglet } = await searchParams
  const tab = TABS.find((t) => t.key === onglet)?.key ?? 'cours'

  const mod = await prisma.module.findFirst({
    where: { id, deletedAt: null },
    select: {
      id: true,
      code: true,
      name: true,
      description: true,
      teacherName: true,
      teacherEmail: true,
      credits: true,
      color: true,
      classGroupId: true,
      semesterId: true,
      semester: {
        select: { label: true, isArchived: true, academicYear: { select: { label: true } } },
      },
    },
  })

  // Un module d'une autre classe renvoie 404 : l'existence meme du module
  // n'est pas revelee.
  if (!mod || !canViewClass(user, mod.classGroupId)) notFound()

  // Seul le delegue de la classe active peut gerer le contenu.
  const canManage = user.role === 'ADMIN'

  const kindByTab: Record<string, string[]> = {
    cours: ['COURS', 'PRESENTATION'],
    td: ['TD'],
    tp: ['TP'],
    examens: ['EXAMEN', 'CORRECTION'],
  }

  const [resources, projects, announcements, schedule, counts, modules, semesters, defaultSemesterId] =
    await Promise.all([
      tab in kindByTab
        ? prisma.resource.findMany({
            where: {
              moduleId: mod.id,
              deletedAt: null,
              isArchived: false,
              kind: { in: kindByTab[tab] as never[] },
            },
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
        : Promise.resolve([]),

      tab === 'projets'
        ? prisma.project.findMany({
            where: { moduleId: mod.id, deletedAt: null },
            select: {
              id: true,
              title: true,
              description: true,
              dueAt: true,
              teacherName: true,
            },
            orderBy: { dueAt: 'asc' },
          })
        : Promise.resolve([]),

      tab === 'annonces'
        ? prisma.announcement.findMany({
            where: { moduleId: mod.id, deletedAt: null },
            select: {
              id: true,
              title: true,
              content: true,
              level: true,
              category: true,
              publishedAt: true,
              isPinned: true,
              author: { select: { firstName: true, lastName: true } },
            },
            orderBy: { publishedAt: 'desc' },
          })
        : Promise.resolve([]),

      prisma.scheduleEntry.findMany({
        where: {
          moduleId: mod.id,
          deletedAt: null,
          isPublished: true,
          date: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
        },
        select: {
          id: true,
          type: true,
          title: true,
          date: true,
          startMinutes: true,
          endMinutes: true,
          room: true,
          teacherName: true,
          note: true,
          module: { select: { code: true, name: true, color: true } },
        },
        orderBy: [{ date: 'asc' }, { startMinutes: 'asc' }],
        take: 4,
      }),

      prisma.resource.groupBy({
        by: ['kind'],
        where: { moduleId: mod.id, deletedAt: null, isArchived: false },
        _count: { _all: true },
      }),

      getClassModules(mod.classGroupId),
      getClassSemesters(mod.classGroupId),
      getDefaultSemesterId(mod.classGroupId),
    ])

  const countFor = (kinds: string[]) =>
    counts.filter((c) => kinds.includes(c.kind)).reduce((sum, c) => sum + c._count._all, 0)

  const moduleOptions = modules.map((m) => ({ id: m.id, code: m.code, name: m.name }))
  const semesterOptions = semesters.map((s) => ({
    id: s.id,
    label: s.label,
    academicYear: { label: s.academicYear.label },
  }))

  return (
    <>
      <PageHeader
        title={mod.name}
        description={mod.description ?? undefined}
        breadcrumb={[
          { label: 'Modules', href: '/modules' },
          { label: mod.code },
        ]}
        actions={
          canManage ? (
            <AddResourceButton
              modules={moduleOptions}
              semesters={semesterOptions}
              defaultSemesterId={defaultSemesterId ?? mod.semesterId}
              defaultModuleId={mod.id}
              label="Deposer un document"
            />
          ) : null
        }
      />

      <div className="grid lg:grid-cols-[1fr_300px] gap-4">
        <div>
          <div className="flex items-center gap-1 mb-4 overflow-x-auto pb-1">
            {TABS.map((t) => {
              const active = t.key === tab
              return (
                <Link
                  key={t.key}
                  href={`/modules/${mod.id}?onglet=${t.key}`}
                  className={cn(
                    'shrink-0 rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors',
                    active
                      ? 'bg-[var(--accent-soft)] text-[var(--accent-strong)]'
                      : 'text-[var(--text-2)] hover:bg-[var(--surface-3)]',
                  )}
                >
                  {t.label}
                </Link>
              )
            })}
          </div>

          <Card>
            {tab === 'projets' ? (
              projects.length > 0 ? (
                <CardBody className="space-y-2.5">
                  {projects.map((project) => (
                    <Link
                      key={project.id}
                      href={`/projets/${project.id}`}
                      className="block rounded-xl border border-[var(--border)] p-3.5 hover:bg-[var(--surface-2)] transition-colors"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-[14px] font-medium text-[var(--text-1)]">
                            {project.title}
                          </p>
                          {project.description ? (
                            <p className="mt-1 text-[12.5px] text-[var(--text-2)] line-clamp-2">
                              {project.description}
                            </p>
                          ) : null}
                        </div>
                        <span className="shrink-0 text-[12.5px] font-medium text-[var(--warning)]">
                          {formatCountdown(project.dueAt)}
                        </span>
                      </div>
                    </Link>
                  ))}
                </CardBody>
              ) : (
                <EmptyState
                  icon={<IconProject />}
                  title="Aucun projet"
                  description="Aucun projet n est rattache a ce module."
                />
              )
            ) : tab === 'annonces' ? (
              announcements.length > 0 ? (
                <CardBody className="space-y-3">
                  {announcements.map((a) => (
                    <AnnouncementCard key={a.id} announcement={a} />
                  ))}
                </CardBody>
              ) : (
                <EmptyState
                  icon={<IconMegaphone />}
                  title="Aucune annonce"
                  description="Aucune annonce liee a ce module."
                />
              )
            ) : resources.length > 0 ? (
              <CardBody className="space-y-2.5">
                {resources.map((resource) => (
                  <ResourceItem key={resource.id} resource={resource} />
                ))}
              </CardBody>
            ) : (
              <EmptyState
                icon={<IconFile />}
                title="Aucun document"
                description={
                  canManage
                    ? 'Deposez le premier document de cette rubrique.'
                    : 'Rien n a encore ete depose dans cette rubrique.'
                }
              />
            )}
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader title="Informations" />
            <CardBody className="space-y-3">
              <InfoRow label="Code" value={mod.code} />
              <InfoRow label="Professeur" value={mod.teacherName ?? 'Non renseigne'} />
              {mod.teacherEmail ? (
                <InfoRow
                  label="Contact"
                  value={
                    <a
                      href={`mailto:${mod.teacherEmail}`}
                      className="text-[var(--accent)] hover:underline underline-offset-2"
                    >
                      {mod.teacherEmail}
                    </a>
                  }
                />
              ) : null}
              <InfoRow label="Semestre" value={mod.semester.label} />
              <InfoRow label="Annee" value={mod.semester.academicYear.label} />
              {mod.credits ? <InfoRow label="Credits" value={String(mod.credits)} /> : null}
              {mod.semester.isArchived ? (
                <div className="pt-1">
                  <Badge tone="warning">Semestre archive</Badge>
                </div>
              ) : null}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Contenu disponible" />
            <CardBody className="space-y-2">
              <CountRow label="Cours et presentations" value={countFor(['COURS', 'PRESENTATION'])} />
              <CountRow label="TD" value={countFor(['TD'])} />
              <CountRow label="TP" value={countFor(['TP'])} />
              <CountRow label="Examens et corrections" value={countFor(['EXAMEN', 'CORRECTION'])} />
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Prochaines séances" />
            <CardBody className="space-y-2.5">
              {schedule.length > 0 ? (
                schedule.map((entry) => (
                  <div key={entry.id}>
                    <p className="mb-1 text-[11.5px] text-[var(--text-3)]">
                      {formatDateShort(entry.date)}
                    </p>
                    <ScheduleItem entry={entry} />
                  </div>
                ))
              ) : (
                <EmptyState
                  icon={<IconClock />}
                  title="Aucune séance"
                  description="Aucune séance à venir pour ce module."
                  className="py-8"
                />
              )}
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  )
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-[12.5px] text-[var(--text-3)]">{label}</span>
      <span className="text-[13px] font-medium text-[var(--text-1)] text-right">{value}</span>
    </div>
  )
}

function CountRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[12.5px] text-[var(--text-2)]">{label}</span>
      <span className="text-[13px] font-semibold tabular-nums text-[var(--text-1)]">{value}</span>
    </div>
  )
}
