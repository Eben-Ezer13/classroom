import type { Metadata } from 'next'
import { requirePageUser } from '@/lib/auth/guards'
import { classMemberStats, listClassMembers } from '@/lib/services/classes'
import { PageHeader } from '@/components/layout/page-header'
import { Card } from '@/components/ui/card'
import { EmptyState, StatTile } from '@/components/ui/feedback'
import { Badge } from '@/components/ui/badge'
import { Avatar } from '@/components/ui/avatar'
import { Input } from '@/components/ui/field'
import { LinkButton } from '@/components/ui/button'
import { NoClassState } from '@/components/ui/no-class'
import { FilterBar, FilterField } from '@/components/features/filter-bar'
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table'
import { IconUsers } from '@/components/ui/icons'
import { CLASS_ROLE_LABELS } from '@/lib/constants'
import { formatRelative, normalizeSearch } from '@/lib/utils'

export const metadata: Metadata = { title: 'Membres' }

/**
 * Annuaire de la classe active, visible par tous ses membres.
 *
 * La liste vient de listClassMembers(classId) : elle ne contient que les
 * membres de la classe ouverte. Un utilisateur inscrit dans deux classes
 * voit deux annuaires distincts selon l'espace selectionne, jamais un
 * melange des deux.
 */
export default async function MembersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const user = await requirePageUser()
  const params = await searchParams
  const q = normalizeSearch(params.q)

  if (!user.classGroupId) {
    return (
      <>
        <PageHeader title="Membres" />
        <NoClassState />
      </>
    )
  }

  const isAdmin = user.role === 'ADMIN'

  const [members, stats] = await Promise.all([
    listClassMembers(user.classGroupId, { q, searchEmail: isAdmin }),
    classMemberStats(user.classGroupId),
  ])

  return (
    <>
      <PageHeader
        title="Membres"
        description={`Membres de ${user.className ?? 'votre classe'}.`}
        actions={
          isAdmin ? (
            <LinkButton href="/admin/membres" size="sm">
              Gérer les membres
            </LinkButton>
          ) : null
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <StatTile label="Étudiants" value={stats.students} tone="accent" />
        <StatTile label="Délégués" value={stats.admins} tone="info" />
        <StatTile
          label="En ligne"
          value={stats.online}
          hint="activité < 5 min"
          tone={stats.online > 0 ? 'success' : 'neutral'}
        />
        <StatTile label="Total" value={stats.total} />
      </div>

      <FilterBar action="/membres" hasFilters={Boolean(q)}>
        <FilterField label="Recherche" htmlFor="q" className="min-w-[220px] flex-1">
          <Input
            id="q"
            name="q"
            defaultValue={q}
            placeholder={isAdmin ? 'Nom, e-mail, numéro...' : 'Nom ou numéro...'}
          />
        </FilterField>
      </FilterBar>

      <Card>
        {members.length === 0 ? (
          <EmptyState
            icon={<IconUsers />}
            title={q ? 'Aucun résultat' : 'Aucun membre'}
            description={
              q
                ? 'Aucun membre ne correspond à cette recherche.'
                : 'Les étudiants apparaîtront ici dès qu’ils auront rejoint la classe.'
            }
          />
        ) : (
          <Table>
            <THead>
              <TH>Membre</TH>
              <TH>Numéro</TH>
              <TH>Rôle</TH>
              <TH>Statut</TH>
              <TH align="right">Dernière activité</TH>
            </THead>
            <TBody>
              {members.map((member) => (
                <TR key={member.membershipId}>
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
                        </p>
                        {/* Les adresses restent reservees au delegue : un etudiant
                            ne voit pas celles de ses camarades. */}
                        {isAdmin ? (
                          <p className="text-[12px] text-[var(--text-3)] truncate">
                            {member.email}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </TD>
                  <TD>{member.studentId ?? '—'}</TD>
                  <TD>
                    <Badge tone={member.role === 'ADMIN' ? 'accent' : 'neutral'}>
                      {CLASS_ROLE_LABELS[member.role]}
                    </Badge>
                  </TD>
                  <TD>
                    {member.online ? (
                      <Badge tone="success" dot>
                        En ligne
                      </Badge>
                    ) : (
                      <Badge dot>Hors ligne</Badge>
                    )}
                  </TD>
                  <TD align="right">
                    {member.lastSeenAt ? formatRelative(member.lastSeenAt) : 'Jamais'}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Card>
    </>
  )
}
