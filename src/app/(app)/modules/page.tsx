import type { Metadata } from 'next'
import Link from 'next/link'
import { requirePageUser } from '@/lib/auth/guards'
import { prisma } from '@/lib/db'
import { getClassSemesters, getDefaultSemesterId } from '@/lib/services/class-context'
import { PageHeader } from '@/components/layout/page-header'
import { Card, CardBody } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/feedback'
import { Badge } from '@/components/ui/badge'
import { NoClassState } from '@/components/ui/no-class'
import { IconBook, IconChevronRight } from '@/components/ui/icons'
import { AddModuleButton, ModuleActions } from './module-controls'

export const metadata: Metadata = { title: 'Modules' }

export default async function ModulesPage({
  searchParams,
}: {
  searchParams: Promise<{ nouveau?: string }>
}) {
  const user = await requirePageUser()
  const params = await searchParams

  if (!user.classGroupId) {
    return (
      <>
        <PageHeader title="Modules" />
        <NoClassState />
      </>
    )
  }

  // Seul le delegue de la classe active peut gerer le contenu.
  const canManage = user.role === 'ADMIN'

  const [modules, semesters, defaultSemesterId] = await Promise.all([
    prisma.module.findMany({
      where: { classGroupId: user.classGroupId, deletedAt: null },
      select: {
        id: true,
        code: true,
        name: true,
        description: true,
        teacherName: true,
        teacherEmail: true,
        credits: true,
        color: true,
        semesterId: true,
        semester: {
          select: {
            id: true,
            label: true,
            isArchived: true,
            academicYear: { select: { label: true } },
          },
        },
        _count: { select: { resources: true, projects: true, schedule: true } },
      },
      orderBy: [{ semester: { number: 'asc' } }, { code: 'asc' }],
    }),
    getClassSemesters(user.classGroupId),
    getDefaultSemesterId(user.classGroupId),
  ])

  const semesterOptions = semesters.map((s) => ({
    id: s.id,
    label: s.label,
    academicYear: { label: s.academicYear.label },
  }))

  // Regroupement par semestre : l'annee archivee reste consultable mais
  // clairement separee de l'annee en cours.
  const grouped = new Map<string, typeof modules>()
  for (const mod of modules) {
    const key = `${mod.semester.label} — ${mod.semester.academicYear.label}`
    const bucket = grouped.get(key)
    if (bucket) bucket.push(mod)
    else grouped.set(key, [mod])
  }

  return (
    <>
      <PageHeader
        title="Modules"
        description="Chaque module regroupe ses cours, TD, TP, projets et annonces."
        actions={
          canManage ? (
            <AddModuleButton
              semesters={semesterOptions}
              defaultSemesterId={defaultSemesterId}
              autoOpen={params.nouveau === '1'}
            />
          ) : null
        }
      />

      {modules.length === 0 ? (
        <Card>
          <EmptyState
            icon={<IconBook />}
            title="Aucun module"
            description={
              canManage
                ? 'Créez les modules du semestre pour structurer les ressources et le programme.'
                : 'Les modules du semestre apparaitront ici une fois crees.'
            }
          />
        </Card>
      ) : (
        <div className="space-y-6">
          {Array.from(grouped.entries()).map(([label, items]) => (
            <section key={label}>
              <div className="flex items-center gap-2 mb-2.5">
                <h2 className="text-[13px] font-semibold uppercase tracking-wide text-[var(--text-3)]">
                  {label}
                </h2>
                {items[0]?.semester.isArchived ? <Badge>Archive</Badge> : null}
              </div>

              <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
                {items.map((mod) => (
                  <Card key={mod.id} className="hover:shadow-[var(--shadow-md)] transition-shadow">
                    <CardBody className="p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span
                            className="size-9 rounded-lg grid place-items-center text-[12px] font-bold text-white shrink-0"
                            style={{ background: mod.color ?? 'var(--accent)' }}
                          >
                            {mod.code.slice(0, 3)}
                          </span>
                          <div className="min-w-0">
                            <p className="text-[11.5px] font-semibold text-[var(--text-3)] uppercase tracking-wide">
                              {mod.code}
                            </p>
                            <Link
                              href={`/modules/${mod.id}`}
                              className="text-[14.5px] font-semibold text-[var(--text-1)] hover:text-[var(--accent)] transition-colors line-clamp-1"
                            >
                              {mod.name}
                            </Link>
                          </div>
                        </div>
                        {canManage ? (
                          <ModuleActions
                            module={{
                              id: mod.id,
                              semesterId: mod.semesterId,
                              code: mod.code,
                              name: mod.name,
                              description: mod.description,
                              teacherName: mod.teacherName,
                              teacherEmail: mod.teacherEmail,
                              credits: mod.credits,
                              color: mod.color,
                            }}
                            semesters={semesterOptions}
                            defaultSemesterId={defaultSemesterId}
                          />
                        ) : null}
                      </div>

                      {mod.teacherName ? (
                        <p className="mt-3 text-[12.5px] text-[var(--text-2)]">
                          {mod.teacherName}
                        </p>
                      ) : null}

                      <div className="mt-3 flex items-center gap-1.5 flex-wrap">
                        <Badge tone="accent">{mod._count.resources} ressource(s)</Badge>
                        <Badge tone="info">{mod._count.schedule} séance(s)</Badge>
                        {mod._count.projects > 0 ? (
                          <Badge tone="warning">{mod._count.projects} projet(s)</Badge>
                        ) : null}
                        {mod.credits ? <Badge>{mod.credits} credits</Badge> : null}
                      </div>

                      <Link
                        href={`/modules/${mod.id}`}
                        className="mt-3.5 inline-flex items-center gap-1 text-[12.5px] font-medium text-[var(--accent)] hover:gap-1.5 transition-all"
                      >
                        Ouvrir le module
                        <IconChevronRight className="size-3.5" />
                      </Link>
                    </CardBody>
                  </Card>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </>
  )
}
