import type { Metadata } from 'next'
import { prisma } from '@/lib/db'
import { requirePageClassAdmin } from '@/lib/auth/guards'
import { PageHeader } from '@/components/layout/page-header'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { EmptyState, StatTile } from '@/components/ui/feedback'
import { Badge } from '@/components/ui/badge'
import { ConfirmForm, IconSubmit } from '@/components/ui/confirm-form'
import { IconArchive } from '@/components/ui/icons'
import { formatCalendarDate } from '@/lib/utils'
import { toggleYearArchiveAction } from '@/app/actions/admin'

export const metadata: Metadata = { title: 'Archives' }

export default async function AdminArchivesPage() {
  const { classId } = await requirePageClassAdmin()

  const [years, archivedResources, archivedSemesters] = await Promise.all([
    prisma.academicYear.findMany({
      where: { classGroupId: classId },
      select: {
        id: true,
        label: true,
        startsAt: true,
        endsAt: true,
        isCurrent: true,
        isArchived: true,
        semesters: {
          select: {
            id: true,
            label: true,
            isArchived: true,
            _count: { select: { modules: true, resources: true, projects: true } },
          },
        },
      },
      orderBy: { startsAt: 'desc' },
    }),
    prisma.resource.count({
      where: { classGroupId: classId, deletedAt: null, isArchived: true },
    }),
    prisma.semester.count({
      where: { isArchived: true, academicYear: { classGroupId: classId } },
    }),
  ])

  const archived = years.filter((y) => y.isArchived)
  const active = years.filter((y) => !y.isArchived)

  const totals = (year: (typeof years)[number]) =>
    year.semesters.reduce(
      (acc, s) => ({
        modules: acc.modules + s._count.modules,
        resources: acc.resources + s._count.resources,
        projects: acc.projects + s._count.projects,
      }),
      { modules: 0, resources: 0, projects: 0 },
    )

  return (
    <>
      <PageHeader
        title="Archives"
        description="Archiver une année retire ses semestres et ses ressources de l’affichage courant, sans rien supprimer."
        breadcrumb={[{ label: 'Administration', href: '/admin' }, { label: 'Archives' }]}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <StatTile label="Années actives" value={active.length} tone="success" />
        <StatTile label="Années archivées" value={archived.length} tone="warning" />
        <StatTile label="Semestres archives" value={archivedSemesters} />
        <StatTile label="Ressources archivees" value={archivedResources} tone="info" />
      </div>

      <div className="space-y-4">
        <Card>
          <CardHeader
            title="Années en cours"
            description="Visibles par les étudiants et les délégués."
          />
          <CardBody className="space-y-2.5">
            {active.length === 0 ? (
              <p className="text-[13px] text-[var(--text-3)]">Aucune année active.</p>
            ) : (
              active.map((year) => {
                const t = totals(year)
                return (
                  <div
                    key={year.id}
                    className="flex items-start justify-between gap-3 rounded-xl border border-[var(--border)] p-3.5"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[14px] font-medium text-[var(--text-1)]">
                          {year.label}
                        </span>
                        {year.isCurrent ? <Badge tone="success">Courante</Badge> : null}
                      </div>
                      <p className="mt-1 text-[12px] text-[var(--text-3)]">
                        {formatCalendarDate(year.startsAt)} → {formatCalendarDate(year.endsAt)} ·{' '}
                        {year.semesters.length} semestre(s) · {t.modules} module(s) ·{' '}
                        {t.resources} ressource(s) · {t.projects} projet(s)
                      </p>
                    </div>

                    <ConfirmForm
                      action={toggleYearArchiveAction}
                      hidden={{ yearId: year.id }}
                      message={`Archiver ${year.label} ? Ses semestres et ses ${t.resources} ressource(s) passeront en archives.`}
                    >
                      <IconSubmit label="Archiver cette année">
                        <IconArchive className="size-[17px]" />
                      </IconSubmit>
                    </ConfirmForm>
                  </div>
                )
              })
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Années archivées"
            description="Conservees en base, masquees de l affichage courant."
          />
          {archived.length === 0 ? (
            <EmptyState
              icon={<IconArchive />}
              title="Aucune archive"
              description="Les annees terminees que vous archivez apparaitront ici."
            />
          ) : (
            <CardBody className="space-y-2.5">
              {archived.map((year) => {
                const t = totals(year)
                return (
                  <div
                    key={year.id}
                    className="flex items-start justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-3.5"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[14px] font-medium text-[var(--text-2)]">
                          {year.label}
                        </span>
                        <Badge tone="warning">Archivee</Badge>
                      </div>
                      <p className="mt-1 text-[12px] text-[var(--text-3)]">
                        {year.semesters.length} semestre(s) · {t.modules} module(s) ·{' '}
                        {t.resources} ressource(s) · {t.projects} projet(s)
                      </p>
                    </div>

                    <ConfirmForm
                      action={toggleYearArchiveAction}
                      hidden={{ yearId: year.id }}
                      message={`Desarchiver ${year.label} ? Son contenu redeviendra visible.`}
                    >
                      <IconSubmit label="Desarchiver cette annee">
                        <IconArchive className="size-[17px]" />
                      </IconSubmit>
                    </ConfirmForm>
                  </div>
                )
              })}
            </CardBody>
          )}
        </Card>
      </div>
    </>
  )
}
