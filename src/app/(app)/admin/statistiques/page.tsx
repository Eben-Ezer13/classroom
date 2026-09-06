import type { Metadata } from 'next'
import { prisma } from '@/lib/db'
import { requirePageClassAdmin } from '@/lib/auth/guards'
import { classMemberStats, classStorage } from '@/lib/services/classes'
import { topDownloadedResources } from '@/lib/services/resources'
import { PageHeader } from '@/components/layout/page-header'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { StatTile } from '@/components/ui/feedback'
import { Badge } from '@/components/ui/badge'
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table'
import { RESOURCE_KIND_LABELS } from '@/lib/constants'
import { formatFileSize, formatRelative } from '@/lib/utils'

export const metadata: Metadata = { title: 'Statistiques' }

export default async function AdminStatsPage() {
  // Toutes les mesures sont bornees a la classe active : cet ecran ne
  // laisse rien filtrer d'une autre classe.
  const { user, classId } = await requirePageClassAdmin()
  const now = new Date()
  const monthAgo = new Date(now.getTime() - 30 * 86_400_000)
  const weekAgo = new Date(now.getTime() - 7 * 86_400_000)

  const [
    totalResources,
    totalDownloads,
    activeUsers,
    memberStats,
    storage,
    announcements,
    polls,
    complaintsByStatus,
    resourcesByKind,
    topResources,
    modules,
    recentActivity,
  ] = await Promise.all([
    prisma.resource.count({ where: { classGroupId: classId, deletedAt: null } }),
    prisma.download.count({ where: { resource: { classGroupId: classId } } }),
    prisma.membership.count({
      where: {
        classGroupId: classId,
        isActive: true,
        user: { deletedAt: null, isActive: true, lastSeenAt: { gte: monthAgo } },
      },
    }),
    classMemberStats(classId),
    classStorage(classId),
    prisma.announcement.count({ where: { classGroupId: classId, deletedAt: null } }),
    prisma.poll.count({ where: { classGroupId: classId, deletedAt: null } }),
    prisma.complaint.groupBy({
      by: ['status'],
      where: { classGroupId: classId, deletedAt: null },
      _count: { _all: true },
    }),
    prisma.resource.groupBy({
      by: ['kind'],
      where: { classGroupId: classId, deletedAt: null },
      _count: { _all: true },
    }),
    topDownloadedResources(classId, 10),
    prisma.module.count({ where: { classGroupId: classId, deletedAt: null } }),
    prisma.auditLog.count({
      where: { classGroupId: classId, createdAt: { gte: weekAgo } },
    }),
  ])

  const maxKind = Math.max(1, ...resourcesByKind.map((r) => r._count._all))
  const complaintCount = (status: string) =>
    complaintsByStatus.find((c) => c.status === status)?._count._all ?? 0

  return (
    <>
      <PageHeader
        title="Statistiques"
        description={`Usage de ${user.className ?? 'votre classe'}.`}
        breadcrumb={[{ label: 'Administration', href: '/admin' }, { label: 'Statistiques' }]}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <StatTile label="Ressources" value={totalResources} tone="accent" />
        <StatTile label="Telechargements" value={totalDownloads} tone="info" />
        <StatTile
          label="Membres actifs"
          value={activeUsers}
          hint={`sur ${memberStats.total} · 30 derniers jours`}
          tone="success"
        />
        <StatTile label="Actions / 7j" value={recentActivity} tone="warning" />
        <StatTile label="Annonces" value={announcements} />
        <StatTile label="Sondages" value={polls} />
        <StatTile
          label="Réclamations ouvertes"
          value={complaintCount('EN_ATTENTE') + complaintCount('EN_COURS')}
          tone={complaintCount('EN_ATTENTE') > 0 ? 'danger' : 'neutral'}
        />
        <StatTile label="Réclamations résolues" value={complaintCount('RESOLU')} tone="success" />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader
            title="Repartition des ressources"
            description="Par type de document"
          />
          <CardBody className="space-y-2.5">
            {resourcesByKind.length === 0 ? (
              <p className="text-[13px] text-[var(--text-3)]">Aucune ressource déposée.</p>
            ) : (
              resourcesByKind
                .sort((a, b) => b._count._all - a._count._all)
                .map((row) => (
                  <div key={row.kind}>
                    <div className="flex items-baseline justify-between gap-2 mb-1">
                      <span className="text-[13px] text-[var(--text-1)]">
                        {RESOURCE_KIND_LABELS[row.kind] ?? row.kind}
                      </span>
                      <span className="text-[12.5px] font-medium tabular-nums text-[var(--text-2)]">
                        {row._count._all}
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-[var(--surface-3)] overflow-hidden">
                      <div
                        className="h-full rounded-full bg-[var(--accent)]"
                        style={{ width: `${(row._count._all / maxKind) * 100}%` }}
                      />
                    </div>
                  </div>
                ))
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Ressources les plus telechargees"
            description="Dans votre classe"
          />
          <CardBody>
            {topResources.length === 0 ? (
              <p className="text-[13px] text-[var(--text-3)]">
                Aucun telechargement enregistre.
              </p>
            ) : (
              <ol className="space-y-2.5">
                {topResources.map((resource, index) => (
                  <li key={resource.id} className="flex items-center gap-3">
                    <span className="size-6 shrink-0 rounded-md bg-[var(--surface-3)] grid place-items-center text-[11.5px] font-semibold text-[var(--text-2)]">
                      {index + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-medium text-[var(--text-1)] truncate">
                        {resource.title}
                      </p>
                      <p className="text-[11.5px] text-[var(--text-3)]">
                        {resource.module?.code ?? 'Sans module'}
                      </p>
                    </div>
                    <Badge tone="accent">{resource.downloadCount}</Badge>
                  </li>
                ))}
              </ol>
            )}
          </CardBody>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader title="Synthese de la classe" />
          <CardBody className="p-0">
            <Table>
              <THead>
                <TH>Indicateur</TH>
                <TH align="right">Valeur</TH>
              </THead>
              <TBody>
                <TR>
                  <TD>Membres (dont délégués)</TD>
                  <TD align="right">
                    {memberStats.total} ({memberStats.admins})
                  </TD>
                </TR>
                <TR>
                  <TD>Membres en ligne</TD>
                  <TD align="right">{memberStats.online}</TD>
                </TR>
                <TR>
                  <TD>Modules</TD>
                  <TD align="right">{modules}</TD>
                </TR>
                <TR>
                  <TD>Stockage utilise</TD>
                  <TD align="right">
                    {formatFileSize(storage.used)} / {formatFileSize(storage.quota)}
                  </TD>
                </TR>
              </TBody>
            </Table>
          </CardBody>
        </Card>
      </div>

      <p className="mt-4 text-[12px] text-[var(--text-3)]">
        Donnees calculees en direct depuis PostgreSQL · {formatRelative(now)}
      </p>
    </>
  )
}
