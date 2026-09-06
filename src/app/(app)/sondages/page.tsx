import type { Metadata } from 'next'
import { requirePageUser } from '@/lib/auth/guards'
import { prisma } from '@/lib/db'
import { PageHeader } from '@/components/layout/page-header'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/feedback'
import { Badge } from '@/components/ui/badge'
import { NoClassState } from '@/components/ui/no-class'
import { IconPoll } from '@/components/ui/icons'
import { formatDateTime, formatRelative } from '@/lib/utils'
import { AddPollButton, PollActions, VoteForm } from './poll-controls'

export const metadata: Metadata = { title: 'Sondages' }

export default async function PollsPage({
  searchParams,
}: {
  searchParams: Promise<{ nouveau?: string }>
}) {
  const user = await requirePageUser()
  const params = await searchParams

  if (!user.classGroupId) {
    return (
      <>
        <PageHeader title="Sondages" />
        <NoClassState />
      </>
    )
  }

  // Seul le delegue de la classe active peut gerer le contenu.
  const canManage = user.role === 'ADMIN'

  const [polls, myVotes] = await Promise.all([
    prisma.poll.findMany({
      where: { classGroupId: user.classGroupId, deletedAt: null },
      select: {
        id: true,
        title: true,
        description: true,
        allowMultiple: true,
        isAnonymous: true,
        startsAt: true,
        endsAt: true,
        closedAt: true,
        createdBy: { select: { firstName: true, lastName: true } },
        options: {
          select: {
            id: true,
            label: true,
            position: true,
            _count: { select: { votes: true } },
          },
          orderBy: { position: 'asc' },
        },
        _count: { select: { votes: true } },
      },
      orderBy: [{ closedAt: 'asc' }, { endsAt: 'asc' }],
    }),
    prisma.pollVote.findMany({
      where: { userId: user.id },
      select: { pollId: true, optionId: true },
    }),
  ])

  const votedPolls = new Set(myVotes.map((v) => v.pollId))
  const myOptions = new Set(myVotes.map((v) => v.optionId))
  const now = Date.now()

  return (
    <>
      <PageHeader
        title="Sondages"
        description="Consultations de la classe : dates, choix de sujets, organisation."
        actions={canManage ? <AddPollButton autoOpen={params.nouveau === '1'} /> : null}
      />

      {polls.length === 0 ? (
        <Card>
          <EmptyState
            icon={<IconPoll />}
            title="Aucun sondage"
            description={
              canManage
                ? 'Créez un sondage pour décider collectivement.'
                : 'Aucune consultation en cours pour le moment.'
            }
          />
        </Card>
      ) : (
        <div className="grid lg:grid-cols-2 gap-4">
          {polls.map((poll) => {
            const isClosed = Boolean(poll.closedAt) || poll.endsAt.getTime() < now
            const hasVoted = votedPolls.has(poll.id)
            // Les resultats sont reveles apres le vote ou la cloture : voir
            // les scores avant de voter influencerait les reponses.
            const showResults = hasVoted || isClosed || canManage
            const totalVotes = poll.options.reduce((sum, o) => sum + o._count.votes, 0)

            return (
              <Card key={poll.id} id={poll.id}>
                <CardHeader
                  title={poll.title}
                  description={poll.description ?? undefined}
                  action={canManage ? <PollActions pollId={poll.id} isClosed={isClosed} /> : null}
                />
                <CardBody className="space-y-3.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    {isClosed ? (
                      <Badge tone="neutral">Clos</Badge>
                    ) : (
                      <Badge tone="success" dot>
                        Ouvert
                      </Badge>
                    )}
                    {hasVoted ? <Badge tone="accent">Vous avez vote</Badge> : null}
                    {poll.allowMultiple ? <Badge tone="info">Choix multiple</Badge> : null}
                    {poll.isAnonymous ? <Badge>Anonyme</Badge> : null}
                  </div>

                  {showResults ? (
                    <div className="space-y-2.5">
                      {poll.options.map((option) => {
                        const count = option._count.votes
                        const percent = totalVotes > 0 ? (count / totalVotes) * 100 : 0
                        const isMine = myOptions.has(option.id)
                        return (
                          <div key={option.id}>
                            <div className="flex items-baseline justify-between gap-2 mb-1">
                              <span className="text-[13px] text-[var(--text-1)]">
                                {option.label}
                                {isMine ? (
                                  <span className="ml-1.5 text-[11.5px] text-[var(--accent)]">
                                    votre choix
                                  </span>
                                ) : null}
                              </span>
                              <span className="text-[12.5px] font-medium tabular-nums text-[var(--text-2)]">
                                {count} · {percent.toFixed(0)}%
                              </span>
                            </div>
                            <div className="h-2 rounded-full bg-[var(--surface-3)] overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all"
                                style={{
                                  width: `${percent}%`,
                                  background: isMine ? 'var(--accent)' : 'var(--border-strong)',
                                }}
                              />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <VoteForm
                      pollId={poll.id}
                      options={poll.options.map((o) => ({ id: o.id, label: o.label }))}
                      allowMultiple={poll.allowMultiple}
                    />
                  )}

                  <p className="text-[12px] text-[var(--text-3)] pt-1 border-t border-[var(--border)]">
                    {totalVotes} vote{totalVotes > 1 ? 's' : ''}
                    {' · '}
                    {isClosed
                      ? `Clos le ${formatDateTime(poll.closedAt ?? poll.endsAt)}`
                      : `Clôture ${formatRelative(poll.endsAt)}`}
                    {poll.createdBy
                      ? ` · ${poll.createdBy.firstName} ${poll.createdBy.lastName}`
                      : ''}
                  </p>
                </CardBody>
              </Card>
            )
          })}
        </div>
      )}
    </>
  )
}
