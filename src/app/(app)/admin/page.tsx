import type { Metadata } from 'next'
import Link from 'next/link'
import { prisma } from '@/lib/db'
import { requirePageClassAdmin } from '@/lib/auth/guards'
import { classMemberStats, classStorage } from '@/lib/services/classes'
import { getClassProfile } from '@/lib/services/class-context'
import { PageHeader } from '@/components/layout/page-header'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { Alert, StatTile } from '@/components/ui/feedback'
import { Badge } from '@/components/ui/badge'
import { ADMIN_SECTION } from '@/components/layout/nav-config'
import { formatFileSize, formatRelative } from '@/lib/utils'

export const metadata: Metadata = { title: 'Administration' }

/**
 * Vue generale de MA classe.
 *
 * Toutes les statistiques sont filtrees sur classId : cet ecran ne revele
 * jamais l'existence ni le contenu d'une autre classe.
 */
export default async function AdminHomePage({
  searchParams,
}: {
  searchParams: Promise<{ bienvenue?: string }>
}) {
  const { user, classId } = await requirePageClassAdmin()
  const params = await searchParams

  const [profile, members, storage, resources, announcements, complaints, recentAudit] =
    await Promise.all([
      getClassProfile(classId),
      classMemberStats(classId),
      classStorage(classId),
      prisma.resource.count({ where: { classGroupId: classId, deletedAt: null } }),
      prisma.announcement.count({ where: { classGroupId: classId, deletedAt: null } }),
      prisma.complaint.count({
        where: { classGroupId: classId, deletedAt: null, status: 'EN_ATTENTE' },
      }),
      prisma.auditLog.findMany({
        where: { classGroupId: classId },
        select: { id: true, summary: true, action: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
    ])

  const quotaPercent =
    storage.quota > 0 ? Math.min(100, Math.round((storage.used / storage.quota) * 100)) : 0

  return (
    <>
      <PageHeader
        title="Administration de la classe"
        description={
          profile
            ? `${profile.name} · ${profile.schoolName}${profile.programName ? ` · ${profile.programName}` : ''}`
            : undefined
        }
      />

      {params.bienvenue === '1' ? (
        <Alert tone="success" className="mb-4">
          Votre classe est creee. Partagez le code{' '}
          <strong className="font-mono tracking-wider">{profile?.code}</strong> a vos
          etudiants, ou generez un lien d invitation depuis{' '}
          <Link href="/admin/membres" className="underline">
            Membres et invitations
          </Link>
          .
        </Alert>
      ) : null}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <StatTile
          label="Membres"
          value={members.total}
          hint={`${members.admins} delegue(s)`}
          tone="accent"
        />
        <StatTile
          label="En ligne"
          value={members.online}
          hint="activite < 5 min"
          tone={members.online > 0 ? 'success' : 'neutral'}
        />
        <StatTile label="Ressources" value={resources} tone="info" />
        <StatTile label="Annonces" value={announcements} />
        <StatTile
          label="Reclamations"
          value={complaints}
          hint="en attente"
          tone={complaints > 0 ? 'danger' : 'neutral'}
        />
        <StatTile
          label="Stockage"
          value={formatFileSize(storage.used)}
          hint={`${quotaPercent}% de ${formatFileSize(storage.quota)}`}
          tone={quotaPercent > 85 ? 'warning' : 'neutral'}
        />
        <StatTile
          label="Code d inscription"
          value={<span className="font-mono text-[18px]">{profile?.code ?? '—'}</span>}
          hint="a communiquer aux etudiants"
        />
        <StatTile
          label="Delegue principal"
          value={
            <span className="text-[15px]">
              {profile?.createdBy
                ? `${profile.createdBy.firstName} ${profile.createdBy.lastName}`
                : `${user.firstName} ${user.lastName}`}
            </span>
          }
        />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader title="Sections" description="Gestion de votre classe" />
          <CardBody className="grid sm:grid-cols-2 gap-2">
            {ADMIN_SECTION.items
              .filter((item) => item.href !== '/admin')
              .map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  className="flex items-center gap-2.5 rounded-lg border border-[var(--border)] px-3 py-2.5 text-[13px] font-medium text-[var(--text-2)] hover:bg-[var(--surface-2)] hover:text-[var(--text-1)] transition-colors"
                >
                  <Icon className="size-4 text-[var(--text-3)]" />
                  {label}
                </Link>
              ))}
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Activite recente"
            description="Dernieres actions dans votre classe"
            action={
              <Link
                href="/admin/audit"
                className="text-[12.5px] font-medium text-[var(--accent)] hover:underline underline-offset-2"
              >
                Journal complet
              </Link>
            }
          />
          <CardBody>
            {recentAudit.length === 0 ? (
              <p className="text-[13px] text-[var(--text-3)]">Aucune action enregistree.</p>
            ) : (
              <ul className="space-y-2.5">
                {recentAudit.map((entry) => (
                  <li key={entry.id} className="flex items-start gap-2.5">
                    <Badge className="shrink-0 mt-0.5">{entry.action.split('_')[0]}</Badge>
                    <p className="text-[13px] text-[var(--text-2)] leading-relaxed">
                      {entry.summary}{' '}
                      <span className="text-[var(--text-3)]">
                        {formatRelative(entry.createdAt)}
                      </span>
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>
    </>
  )
}
