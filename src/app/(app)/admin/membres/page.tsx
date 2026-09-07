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
import {
  CopyButton,
  EditStudentIdButton,
  NewInvitationButton,
  RemoveMemberButton,
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

  const [members, stats, profile, invitations] = await Promise.all([
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
          hint="activite < 5 min"
          tone={stats.online > 0 ? 'success' : 'neutral'}
        />
      </div>

      <Card className="mb-4">
        <CardHeader
          title="Code d’inscription"
          description="Les étudiants saisissent ce code pour rejoindre la classe."
        />
        <CardBody className="flex flex-wrap items-center gap-3">
          <code className="rounded-lg bg-[var(--surface-3)] px-3 py-2 text-[16px] font-mono tracking-[0.2em] text-[var(--text-1)]">
            {profile?.code}
          </code>
          <CopyButton value={profile?.code ?? ''} label="Copier le code" />
          <ConfirmForm
            action={rotateClassCodeAction}
            message="Régénérer le code ? L’ancien code ne fonctionnera plus."
          >
            <Button type="submit" size="sm" variant="ghost">
              Regenerer
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
                      {invitation.maxUses > 0 ? ` / ${invitation.maxUses}` : ' / illimite'}
                    </TD>
                    <TD>
                      {invitation.expiresAt ? (
                        expired ? (
                          <Badge tone="danger">Expire</Badge>
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
                            Revoquer
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
            title={q ? 'Aucun resultat' : 'Aucun membre'}
            description={
              q
                ? 'Aucun membre ne correspond a cette recherche.'
                : 'Partagez le code de la classe ou créez un lien d’invitation.'
            }
          />
        ) : (
          <Table>
            <THead>
              <TH>Membre</TH>
              <TH>Numero</TH>
              <TH>Statut</TH>
              <TH>Derniere activite</TH>
              <TH>Role</TH>
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
                        <Badge tone="danger">Retire</Badge>
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
                          <RemoveMemberButton
                            membershipId={member.membershipId}
                            name={`${member.firstName} ${member.lastName}`}
                          />
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
