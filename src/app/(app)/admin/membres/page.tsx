import type { Metadata } from 'next'
import { prisma } from '@/lib/db'
import { requirePageClassAdmin } from '@/lib/auth/guards'
import { classMemberStats, listClassMembers } from '@/lib/services/classes'
import { getClassProfile } from '@/lib/services/class-context'
import { rotateClassCodeAction, revokeInvitationAction } from '@/app/actions/classes'
import { env } from '@/lib/env'
import { PageHeader } from '@/components/layout/page-header'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { EmptyState, StatTile } from '@/components/ui/feedback'
import { Badge } from '@/components/ui/badge'
import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/field'
import { ConfirmForm } from '@/components/ui/confirm-form'
import { FilterBar, FilterField } from '@/components/features/filter-bar'
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table'
import { IconUsers } from '@/components/ui/icons'
import { formatDate, formatRelative, normalizeSearch } from '@/lib/utils'
import { CopyInviteLinkButton } from '@/components/features/invite-link-share'
import { assignDeputyAction, reviewDeputyPermissionAction } from '@/app/actions/deputy'
import { ActionForm } from '@/components/ui/confirm-form'
import {
  CopyButton,
  EditStudentIdButton,
  NewInvitationButton,
  RemoveMemberButton,
  ResetPasswordLinkButton,
  RoleSelect,
  ShowInactiveToggle,
} from './member-controls'

export const metadata: Metadata = { title: 'Membres de la classe' }

/**
 * Gestion des membres de MA classe : roles, presence, retrait, invitations.
 *
 * Toutes les listes partent de la table d'appartenance filtree sur classId.
 * Un delegue ne peut donc voir ni administrer aucun compte exterieur a sa
 * classe, meme en manipulant les parametres d'URL.
 */
export default async function AdminMembersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; inactifs?: string }>
}) {
  const { user, classId } = await requirePageClassAdmin()
  const params = await searchParams
  const q = normalizeSearch(params.q)
  const includeInactive = params.inactifs === '1'

  const [members, stats, profile, invitations, permissionRequests] = await Promise.all([
    listClassMembers(classId, { q, includeInactive }),
    classMemberStats(classId),
    getClassProfile(classId),
    prisma.invitation.findMany({
      where: { classGroupId: classId, revokedAt: null },
      select: {
        id: true,
        code: true,
        role: true,
        label: true,
        maxUses: true,
        usedCount: true,
        expiresAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    }),
    prisma.permissionRequest.findMany({
      where: { classGroupId: classId, status: 'PENDING' },
      select: { id: true, permission: true, message: true, createdAt: true, user: { select: { firstName: true, lastName: true } } },
      orderBy: { createdAt: 'asc' },
    }),
  ])

  const baseUrl = env.appUrl

  return (
    <>
      <PageHeader
        title="Membres et invitations"
        description={`${profile?.name ?? 'Votre classe'} — ${profile?.schoolName ?? ''}`}
        breadcrumb={[{ label: 'Administration', href: '/admin' }, { label: 'Membres' }]}
        actions={<NewInvitationButton />}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <StatTile label="Membres" value={stats.total} tone="accent" />
        <StatTile label="Étudiants" value={stats.students} />
        <StatTile label="Délégués" value={stats.admins} tone="info" />
        <StatTile
          label="En ligne"
          value={stats.online}
          hint="activité < 5 min"
          tone={stats.online > 0 ? 'success' : 'neutral'}
        />
      </div>

      <Card className="mb-4">
        <CardHeader
          title="Lien d’invitation et code de la classe"
          description="Partagez le lien d’invitation direct : vos étudiants n’auront qu’à créer leur compte pour rejoindre immédiatement la classe."
        />
        <CardBody className="flex flex-wrap items-center gap-3">
          <code className="rounded-lg bg-[var(--surface-3)] px-3 py-2 text-[16px] font-mono tracking-[0.2em] text-[var(--text-1)]">
            {profile?.code}
          </code>
          {profile?.code ? (
            <CopyInviteLinkButton
              code={profile.code}
              variant="primary"
              label="Copier le lien d’invitation"
            />
          ) : null}
          <CopyButton value={profile?.code ?? ''} label="Copier le code seul" />
          <ConfirmForm
            action={rotateClassCodeAction}
            message="Régénérer le code ? L’ancien code ne fonctionnera plus."
          >
            <Button type="submit" size="sm" variant="ghost">
              Régénérer
            </Button>
          </ConfirmForm>
        </CardBody>
      </Card>

      {invitations.length > 0 ? (
        <Card className="mb-4">
          <CardHeader
            title="Liens d’invitation actifs"
            description="Chaque lien peut porter un rôle, une expiration et un quota d’utilisation."
          />
          <Table>
            <THead>
              <TH>Lien</TH>
              <TH>Rôle</TH>
              <TH>Utilisations</TH>
              <TH>Expiration</TH>
              <TH align="right">Actions</TH>
            </THead>
            <TBody>
              {invitations.map((invitation) => {
                const url = `${baseUrl}/rejoindre?code=${invitation.code}`
                const expired =
                  invitation.expiresAt !== null &&
                  invitation.expiresAt.getTime() < Date.now()
                return (
                  <TR key={invitation.id}>
                    <TD>
                      <p className="font-mono text-[12.5px] text-[var(--text-1)] break-all">
                        {invitation.code}
                      </p>
                      {invitation.label ? (
                        <p className="text-[12px] text-[var(--text-3)]">{invitation.label}</p>
                      ) : null}
                    </TD>
                    <TD>
                      <Badge tone={invitation.role === 'ADMIN' ? 'accent' : 'neutral'}>
                        {invitation.role === 'ADMIN' ? 'Délégué' : 'Étudiant'}
                      </Badge>
                    </TD>
                    <TD>
                      {invitation.usedCount}
                      {invitation.maxUses > 0 ? ` / ${invitation.maxUses}` : ' / illimité'}
                    </TD>
                    <TD>
                      {invitation.expiresAt ? (
                        expired ? (
                          <Badge tone="danger">Expiré</Badge>
                        ) : (
                          formatDate(invitation.expiresAt)
                        )
                      ) : (
                        'Sans expiration'
                      )}
                    </TD>
                    <TD align="right">
                      <div className="flex items-center justify-end gap-1.5">
                        <CopyButton value={url} label="Copier le lien" />
                        <ConfirmForm
                          action={revokeInvitationAction}
                          hidden={{ invitationId: invitation.id }}
                          message="Révoquer ce lien d’invitation ?"
                        >
                          <Button type="submit" size="sm" variant="ghost">
                            Révoquer
                          </Button>
                        </ConfirmForm>
                      </div>
                    </TD>
                  </TR>
                )
              })}
            </TBody>
          </Table>
        </Card>
      ) : null}

      <Card className="mb-4" id="autorisations">
        <CardHeader title="Délégué adjoint et autorisations" description="Désignez un étudiant. Il pourra demander un accès précis, que vous accordez ici." />
        <CardBody className="space-y-4">
          {members.filter((member) => member.role === 'MEMBER' && member.isActive).map((member) => (
            <div key={member.membershipId} className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] pb-3">
              <div>
                <p className="text-sm font-medium text-[var(--text-1)]">{member.firstName} {member.lastName}{member.isDeputy ? ' · adjoint' : ''}</p>
                <p className="text-xs text-[var(--text-3)]">{member.delegatedPermissions.length ? `Accès : ${member.delegatedPermissions.map((permission) => permission === 'ECHEANCES' ? 'échéances' : 'projets').join(', ')}` : 'Aucun accès délégué'}</p>
              </div>
              <ActionForm action={assignDeputyAction} hidden={{ membershipId: member.membershipId, enabled: String(!member.isDeputy) }}>
                <Button size="sm" variant={member.isDeputy ? 'secondary' : 'ghost'}>{member.isDeputy ? 'Retirer l’adjoint' : 'Désigner adjoint'}</Button>
              </ActionForm>
            </div>
          ))}
          {permissionRequests.length ? (
            <div className="space-y-3 pt-2">
              <h3 className="text-sm font-semibold text-[var(--text-1)]">Demandes en attente</h3>
              {permissionRequests.map((request) => (
                <div key={request.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[var(--surface-2)] p-3">
                  <div><p className="text-sm font-medium">{request.user.firstName} {request.user.lastName} · {request.permission === 'ECHEANCES' ? 'gestion des échéances' : 'gestion des projets'}</p>{request.message ? <p className="text-xs text-[var(--text-2)]">{request.message}</p> : null}</div>
                  <div className="flex gap-2">
                    <ActionForm action={reviewDeputyPermissionAction} hidden={{ requestId: request.id, approve: 'true' }}><Button size="sm">Accorder</Button></ActionForm>
                    <ActionForm action={reviewDeputyPermissionAction} hidden={{ requestId: request.id, approve: 'false' }}><Button size="sm" variant="ghost">Refuser</Button></ActionForm>
                  </div>
                </div>
              ))}
            </div>
          ) : <p className="text-xs text-[var(--text-3)]">Aucune demande d’autorisation en attente.</p>}
        </CardBody>
      </Card>

      <FilterBar action="/admin/membres" hasFilters={Boolean(q) || includeInactive}>
        <FilterField label="Recherche" htmlFor="q" className="min-w-[220px] flex-1">
          <Input id="q" name="q" defaultValue={q} placeholder="Nom, e-mail, numéro..." />
        </FilterField>
        <div className="flex items-end pb-1">
          <ShowInactiveToggle checked={includeInactive} />
        </div>
      </FilterBar>

      <Card>
        {members.length === 0 ? (
          <EmptyState
            icon={<IconUsers />}
            title={q ? 'Aucun résultat' : 'Aucun membre'}
            description={
              q
                ? 'Aucun membre ne correspond à cette recherche.'
                : 'Partagez le code de la classe ou créez un lien d’invitation.'
            }
          />
        ) : (
          <Table>
            <THead>
              <TH>Membre</TH>
              <TH>Numéro</TH>
              <TH>Statut</TH>
              <TH>Dernière activité</TH>
              <TH>Rôle</TH>
              <TH align="right">Actions</TH>
            </THead>
            <TBody>
              {members.map((member) => {
                const isSelf = member.userId === user.id
                return (
                  <TR key={member.membershipId} className={member.isActive ? '' : 'opacity-60'}>
                    <TD>
                      <div className="flex items-center gap-2.5">
                        <Avatar
                          firstName={member.firstName}
                          lastName={member.lastName}
                          src={member.avatarUrl}
                          size="sm"
                        />
                        <div className="min-w-0">
                          <p className="text-[13.5px] font-medium text-[var(--text-1)] truncate">
                            {member.firstName} {member.lastName}
                            {isSelf ? (
                              <span className="text-[var(--text-3)] font-normal"> (vous)</span>
                            ) : null}
                          </p>
                          <p className="text-[12px] text-[var(--text-3)] truncate">
                            {member.email}
                          </p>
                        </div>
                      </div>
                    </TD>
                    <TD>{member.studentId ?? '—'}</TD>
                    <TD>
                      {!member.isActive ? (
                        <Badge tone="danger">Retiré</Badge>
                      ) : member.online ? (
                        <Badge tone="success" dot>
                          En ligne
                        </Badge>
                      ) : (
                        <Badge dot>Hors ligne</Badge>
                      )}
                    </TD>
                    <TD>
                      {member.lastSeenAt ? formatRelative(member.lastSeenAt) : 'Jamais'}
                    </TD>
                    <TD>
                      <RoleSelect
                        membershipId={member.membershipId}
                        role={member.role}
                        disabled={isSelf || !member.isActive}
                      />
                    </TD>
                    <TD align="right">
                      <div className="flex items-center justify-end gap-1">
                        <EditStudentIdButton
                          membershipId={member.membershipId}
                          name={`${member.firstName} ${member.lastName}`}
                          studentId={member.studentId}
                        />
                        {isSelf || !member.isActive ? null : (
                          <>
                            <ResetPasswordLinkButton
                              membershipId={member.membershipId}
                              name={`${member.firstName} ${member.lastName}`}
                            />
                            <RemoveMemberButton
                              membershipId={member.membershipId}
                              name={`${member.firstName} ${member.lastName}`}
                            />
                          </>
                        )}
                      </div>
                    </TD>
                  </TR>
                )
              })}
            </TBody>
          </Table>
        )}
      </Card>
    </>
  )
}
