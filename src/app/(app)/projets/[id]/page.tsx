import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { requirePageUser } from '@/lib/auth/guards'
import { getCurrentUser } from '@/lib/auth/session'
import { prisma } from '@/lib/db'
import { canManageClass, canViewClass } from '@/lib/permissions'
import { getClassModules, getClassSemesters } from '@/lib/services/class-context'
import { PageHeader } from '@/components/layout/page-header'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/feedback'
import { Badge } from '@/components/ui/badge'
import { ResourceItem } from '@/components/features/resource-item'
import { IconClock, IconFile, IconLink } from '@/components/ui/icons'
import { cn, formatCountdown, formatDateTime } from '@/lib/utils'
import { AddResourceButton } from '../../ressources/resource-controls'
import { AddProjectLinkForm, DeleteProjectLinkButton } from '../project-controls'

type Props = { params: Promise<{ id: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  // Meme regle que la page : le titre d'un projet d'une autre classe
  // n'apparait pas, meme dans l'onglet du navigateur.
  const user = await getCurrentUser()
  const project = user
    ? await prisma.project.findFirst({
        where: { id, deletedAt: null },
        select: { title: true, classGroupId: true },
      })
    : null
  if (!user || !project || !canViewClass(user, project.classGroupId)) return { title: 'Projet' }
  return { title: project.title }
}

export default async function ProjectDetailPage({ params }: Props) {
  const user = await requirePageUser()
  const { id } = await params

  const project = await prisma.project.findFirst({
    where: { id, deletedAt: null },
    select: {
      id: true,
      title: true,
      description: true,
      instructions: true,
      teacherName: true,
      startsAt: true,
      dueAt: true,
      classGroupId: true,
      semesterId: true,
      module: { select: { id: true, code: true, name: true, color: true } },
      semester: { select: { label: true, academicYear: { select: { label: true } } } },
      createdBy: { select: { firstName: true, lastName: true } },
      links: { select: { id: true, label: true, url: true } },
      documents: {
        where: { deletedAt: null },
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
      },
    },
  })

  if (!project || !canViewClass(user, project.classGroupId)) notFound()

  // Seul un delegue de la classe DU PROJET peut en gerer le contenu.
  const canManage = canManageClass(user, project.classGroupId)
  const remaining = project.dueAt.getTime() - Date.now()
  const overdue = remaining <= 0
  const urgent = remaining > 0 && remaining < 3 * 86_400_000

  const [modules, semesters] = await Promise.all([
    getClassModules(project.classGroupId),
    getClassSemesters(project.classGroupId),
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
        title={project.title}
        description={project.description ?? undefined}
        breadcrumb={[{ label: 'Projets', href: '/projets' }, { label: project.title }]}
        actions={
          canManage ? (
            <AddResourceButton
              modules={moduleOptions}
              semesters={semesterOptions}
              defaultSemesterId={project.semesterId}
              defaultModuleId={project.module?.id}
              classGroupId={project.classGroupId}
              projectId={project.id}
              label="Ajouter un document"
            />
          ) : null
        }
      />

      <div
        className={cn(
          'mb-4 rounded-2xl border p-4 flex items-center justify-between gap-4 flex-wrap',
          overdue
            ? 'border-[var(--border)] bg-[var(--surface-1)]'
            : urgent
              ? 'border-[var(--warning-border)] bg-[var(--warning-soft)]'
              : 'border-[var(--accent-border)] bg-[var(--accent-soft)]',
        )}
      >
        <div className="flex items-center gap-3">
          <span
            className={cn(
              'size-10 rounded-xl grid place-items-center',
              overdue
                ? 'bg-[var(--surface-3)] text-[var(--text-3)]'
                : urgent
                  ? 'bg-[var(--warning)] text-white'
                  : 'bg-[var(--accent)] text-[var(--accent-contrast)]',
            )}
          >
            <IconClock className="size-5" />
          </span>
          <div>
            <p
              className={cn(
                'text-[18px] font-semibold leading-tight',
                overdue
                  ? 'text-[var(--text-2)]'
                  : urgent
                    ? 'text-[var(--warning-strong)]'
                    : 'text-[var(--accent-strong)]',
              )}
            >
              {formatCountdown(project.dueAt)}
            </p>
            <p className="text-[12.5px] text-[var(--text-3)] mt-0.5">
              Rendu attendu le {formatDateTime(project.dueAt)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          {project.module ? (
            <Badge tone="accent">
              {project.module.code} — {project.module.name}
            </Badge>
          ) : null}
          <Badge>{project.semester.label}</Badge>
          <Badge>{project.semester.academicYear.label}</Badge>
        </div>
      </div>

      <div className="grid lg:grid-cols-[1fr_300px] gap-4">
        <div className="space-y-4">
          {project.instructions ? (
            <Card>
              <CardHeader title="Consignes" />
              <CardBody>
                <p className="text-[13.5px] text-[var(--text-2)] leading-relaxed whitespace-pre-line">
                  {project.instructions}
                </p>
              </CardBody>
            </Card>
          ) : null}

          <Card>
            <CardHeader
              title="Documents"
              description={`${project.documents.length} document(s) rattache(s) au projet`}
            />
            {project.documents.length > 0 ? (
              <CardBody className="space-y-2.5">
                {project.documents.map((doc) => (
                  <ResourceItem key={doc.id} resource={doc} />
                ))}
              </CardBody>
            ) : (
              <EmptyState
                icon={<IconFile />}
                title="Aucun document"
                description={
                  canManage
                    ? 'Ajoutez le sujet, le modele de rapport ou tout support utile.'
                    : 'Aucun document n a encore ete joint a ce projet.'
                }
              />
            )}
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader title="Informations" />
            <CardBody className="space-y-3">
              <Row label="Professeur" value={project.teacherName ?? 'Non renseigne'} />
              {project.startsAt ? (
                <Row label="Debut" value={formatDateTime(project.startsAt)} />
              ) : null}
              <Row label="Rendu" value={formatDateTime(project.dueAt)} />
              {project.createdBy ? (
                <Row
                  label="Publie par"
                  value={`${project.createdBy.firstName} ${project.createdBy.lastName}`}
                />
              ) : null}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Liens utiles" />
            <CardBody className="space-y-2.5">
              {project.links.length > 0 ? (
                project.links.map((link) => (
                  <div key={link.id} className="flex items-center gap-2">
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 min-w-0 flex-1 rounded-lg border border-[var(--border)] px-3 py-2 hover:bg-[var(--surface-2)] transition-colors"
                    >
                      <IconLink className="size-4 text-[var(--text-3)] shrink-0" />
                      <span className="text-[13px] text-[var(--accent)] truncate">
                        {link.label}
                      </span>
                    </a>
                    {canManage ? <DeleteProjectLinkButton linkId={link.id} /> : null}
                  </div>
                ))
              ) : (
                <p className="text-[13px] text-[var(--text-3)]">Aucun lien pour le moment.</p>
              )}

              {canManage ? (
                <div className="pt-2 border-t border-[var(--border)]">
                  <AddProjectLinkForm projectId={project.id} />
                </div>
              ) : null}
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-[12.5px] text-[var(--text-3)]">{label}</span>
      <span className="text-[13px] font-medium text-[var(--text-1)] text-right">{value}</span>
    </div>
  )
}
