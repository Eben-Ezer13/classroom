import type { Metadata } from 'next'
import Link from 'next/link'
import { requirePageUser } from '@/lib/auth/guards'
import { prisma } from '@/lib/db'
import {
  getClassModules,
  getClassSemesters,
  getDefaultSemesterId,
} from '@/lib/services/class-context'
import { PageHeader } from '@/components/layout/page-header'
import { Card, CardBody } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/feedback'
import { Badge } from '@/components/ui/badge'
import { NoClassState } from '@/components/ui/no-class'
import { IconProject } from '@/components/ui/icons'
import { cn, formatCountdown, formatDateTime } from '@/lib/utils'
import { AddProjectButton, ProjectActions } from './project-controls'

export const metadata: Metadata = { title: 'Projets' }

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ nouveau?: string; vue?: string }>
}) {
  const user = await requirePageUser()
  const params = await searchParams

  if (!user.classGroupId) {
    return (
      <>
        <PageHeader title="Projets" />
        <NoClassState />
      </>
    )
  }

  // Seul le delegue de la classe active peut gerer le contenu.
  const canManage = user.role === 'ADMIN'
  const showPast = params.vue === 'termines'
  const now = new Date()

  const [projects, modules, semesters, defaultSemesterId] = await Promise.all([
    prisma.project.findMany({
      where: {
        classGroupId: user.classGroupId,
        deletedAt: null,
        dueAt: showPast ? { lt: now } : { gte: now },
      },
      select: {
        id: true,
        title: true,
        description: true,
        instructions: true,
        teacherName: true,
        startsAt: true,
        dueAt: true,
        semesterId: true,
        moduleId: true,
        module: { select: { code: true, name: true, color: true } },
        _count: { select: { documents: true, links: true } },
      },
      orderBy: { dueAt: showPast ? 'desc' : 'asc' },
    }),
    getClassModules(user.classGroupId),
    getClassSemesters(user.classGroupId),
    getDefaultSemesterId(user.classGroupId),
  ])

  const moduleOptions = modules.map((m) => ({ id: m.id, code: m.code, name: m.name }))
  const semesterOptions = semesters.map((s) => ({
    id: s.id,
    label: s.label,
    academicYear: { label: s.academicYear.label },
  }))

  return (
    <>
      <PageHeader
        title="Projets"
        description="Consignes, documents et temps restant avant chaque rendu."
        actions={
          canManage ? (
            <AddProjectButton
              modules={moduleOptions}
              semesters={semesterOptions}
              defaultSemesterId={defaultSemesterId}
              autoOpen={params.nouveau === '1'}
            />
          ) : null
        }
      />

      <div className="flex items-center gap-1 mb-4">
        <Link
          href="/projets"
          className={cn(
            'rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors',
            !showPast
              ? 'bg-[var(--accent-soft)] text-[var(--accent-strong)]'
              : 'text-[var(--text-2)] hover:bg-[var(--surface-3)]',
          )}
        >
          En cours
        </Link>
        <Link
          href="/projets?vue=termines"
          className={cn(
            'rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors',
            showPast
              ? 'bg-[var(--accent-soft)] text-[var(--accent-strong)]'
              : 'text-[var(--text-2)] hover:bg-[var(--surface-3)]',
          )}
        >
          Termines
        </Link>
      </div>

      {projects.length === 0 ? (
        <Card>
          <EmptyState
            icon={<IconProject />}
            title={showPast ? 'Aucun projet termine' : 'Aucun projet en cours'}
            description={
              showPast
                ? 'Les projets dont la date de rendu est passee apparaitront ici.'
                : canManage
                  ? 'Creez un projet pour donner les consignes a la classe.'
                  : 'Aucun projet n est en cours pour le moment.'
            }
          />
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
          {projects.map((project) => {
            const remaining = project.dueAt.getTime() - now.getTime()
            const urgent = remaining > 0 && remaining < 3 * 86_400_000
            const overdue = remaining <= 0

            return (
              <Card
                key={project.id}
                className={cn(
                  'flex flex-col',
                  urgent && 'border-[var(--warning-border)]',
                  overdue && 'opacity-90',
                )}
              >
                <CardBody className="flex-1 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      {project.module ? (
                        <span
                          className="inline-block mb-1.5 rounded px-1.5 py-0.5 text-[10.5px] font-bold text-white"
                          style={{ background: project.module.color ?? 'var(--accent)' }}
                        >
                          {project.module.code}
                        </span>
                      ) : null}
                      <Link
                        href={`/projets/${project.id}`}
                        className="block text-[15px] font-semibold text-[var(--text-1)] hover:text-[var(--accent)] transition-colors leading-snug"
                      >
                        {project.title}
                      </Link>
                    </div>
                    {canManage ? (
                      <ProjectActions
                        project={{
                          id: project.id,
                          semesterId: project.semesterId,
                          moduleId: project.moduleId,
                          title: project.title,
                          description: project.description,
                          instructions: project.instructions,
                          teacherName: project.teacherName,
                          startsAt: project.startsAt,
                          dueAt: project.dueAt,
                        }}
                        modules={moduleOptions}
                        semesters={semesterOptions}
                        defaultSemesterId={defaultSemesterId}
                      />
                    ) : null}
                  </div>

                  {project.description ? (
                    <p className="mt-2 text-[13px] text-[var(--text-2)] line-clamp-3 leading-relaxed">
                      {project.description}
                    </p>
                  ) : null}

                  <div className="mt-3 flex items-center gap-1.5 flex-wrap">
                    {project._count.documents > 0 ? (
                      <Badge tone="accent">{project._count.documents} document(s)</Badge>
                    ) : null}
                    {project._count.links > 0 ? (
                      <Badge tone="info">{project._count.links} lien(s)</Badge>
                    ) : null}
                    {project.teacherName ? <Badge>{project.teacherName}</Badge> : null}
                  </div>
                </CardBody>

                <div
                  className={cn(
                    'px-4 py-3 border-t rounded-b-2xl',
                    overdue
                      ? 'border-[var(--border)] bg-[var(--surface-2)]'
                      : urgent
                        ? 'border-[var(--warning-border)] bg-[var(--warning-soft)]'
                        : 'border-[var(--border)] bg-[var(--surface-2)]',
                  )}
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <span
                      className={cn(
                        'text-[13px] font-semibold',
                        overdue
                          ? 'text-[var(--text-3)]'
                          : urgent
                            ? 'text-[var(--warning-strong)]'
                            : 'text-[var(--text-1)]',
                      )}
                    >
                      {formatCountdown(project.dueAt)}
                    </span>
                    <span className="text-[11.5px] text-[var(--text-3)]">
                      {formatDateTime(project.dueAt)}
                    </span>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </>
  )
}
