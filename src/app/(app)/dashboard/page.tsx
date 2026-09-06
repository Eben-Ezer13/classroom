import type { Metadata } from 'next'
import Link from 'next/link'
import { requirePageUser } from '@/lib/auth/guards'
import { getDelegateDashboard, getStudentDashboard } from '@/lib/services/dashboard'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { EmptyState, StatTile } from '@/components/ui/feedback'
import { LinkButton } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { NoClassState } from '@/components/ui/no-class'
import { ScheduleItem } from '@/components/features/schedule-item'
import { AnnouncementCard } from '@/components/features/announcement-card'
import { DeadlineItem } from '@/components/features/deadline-item'
import { ResourceItem } from '@/components/features/resource-item'
import {
  IconCalendar,
  IconClock,
  IconComplaint,
  IconFolder,
  IconMegaphone,
  IconPlus,
  IconPoll,
  IconUsers,
} from '@/components/ui/icons'
import { formatRelative, formatWeekday, minutesToTime } from '@/lib/utils'

export const metadata: Metadata = { title: 'Tableau de bord' }

export default async function DashboardPage() {
  const user = await requirePageUser()

  if (!user.classGroupId) {
    return (
      <>
        <Greeting firstName={user.firstName} />
        <NoClassState />
      </>
    )
  }

  // Seul le delegue de la classe active dispose des vues de gestion.
  const isStaff = user.role === 'ADMIN'
  const [data, staffData] = await Promise.all([
    getStudentDashboard(user.classGroupId, user.id),
    isStaff ? getDelegateDashboard(user.classGroupId) : Promise.resolve(null),
  ])

  return (
    <>
      <Greeting firstName={user.firstName} className={user.className} />

      {staffData ? <DelegatePanel data={staffData} /> : null}

      <div className="grid lg:grid-cols-3 gap-4">
        {/* ---------------- Colonne principale ---------------- */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader
              title="Programme du jour"
              description={formatWeekday(new Date())}
              action={
                <LinkButton href="/programme" variant="ghost" size="sm">
                  Voir la semaine
                </LinkButton>
              }
            />
            <CardBody className="space-y-2.5">
              {data.nextSession ? (
                <div className="mb-4">
                  <p className="mb-2 text-[11.5px] font-semibold uppercase tracking-wide text-[var(--text-3)]">
                    Prochaine séance
                  </p>
                  <ScheduleItem entry={data.nextSession} highlight />
                  <p className="mt-1.5 text-[12px] text-[var(--text-3)]">
                    {formatWeekday(data.nextSession.date)} a{' '}
                    {minutesToTime(data.nextSession.startMinutes)}
                  </p>
                </div>
              ) : null}

              {data.todayEntries.length > 0 ? (
                <>
                  <p className="mb-2 text-[11.5px] font-semibold uppercase tracking-wide text-[var(--text-3)]">
                    Toutes les séances du jour
                  </p>
                  {data.todayEntries.map((entry) => (
                    <ScheduleItem key={entry.id} entry={entry} />
                  ))}
                </>
              ) : (
                <EmptyState
                  icon={<IconCalendar />}
                  title="Aucune séance aujourd’hui"
                  description="Profitez-en, ou consultez le programme de la semaine."
                  action={
                    <LinkButton href="/programme" variant="secondary" size="sm">
                      Programme de la semaine
                    </LinkButton>
                  }
                />
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Dernieres annonces"
              action={
                <LinkButton href="/annonces" variant="ghost" size="sm">
                  Tout voir
                </LinkButton>
              }
            />
            <CardBody className="space-y-3">
              {data.announcements.length > 0 ? (
                data.announcements.map((announcement) => (
                  <AnnouncementCard
                    key={announcement.id}
                    announcement={announcement}
                    compact
                  />
                ))
              ) : (
                <EmptyState
                  icon={<IconMegaphone />}
                  title="Aucune annonce"
                  description="Les annonces publiées par le délégué apparaîtront ici."
                />
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Dernieres ressources"
              action={
                <LinkButton href="/ressources" variant="ghost" size="sm">
                  Tout voir
                </LinkButton>
              }
            />
            <CardBody className="space-y-2.5">
              {data.resources.length > 0 ? (
                data.resources.map((resource) => (
                  <ResourceItem key={resource.id} resource={resource} />
                ))
              ) : (
                <EmptyState
                  icon={<IconFolder />}
                  title="Aucune ressource"
                  description="Les cours, TD et TP déposés apparaîtront ici."
                />
              )}
            </CardBody>
          </Card>
        </div>

        {/* ---------------- Colonne laterale ---------------- */}
        <div className="space-y-4">
          <Card>
            <CardHeader
              title="Prochaines échéances"
              action={
                <LinkButton href="/echeances" variant="ghost" size="sm">
                  Tout voir
                </LinkButton>
              }
            />
            <CardBody className="space-y-2.5">
              {data.deadlines.length > 0 ? (
                data.deadlines.map((deadline) => (
                  <DeadlineItem key={deadline.id} deadline={deadline} />
                ))
              ) : (
                <EmptyState
                  icon={<IconClock />}
                  title="Aucune échéance"
                  description="Rien à rendre pour le moment."
                />
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Sondages en cours"
              action={
                <LinkButton href="/sondages" variant="ghost" size="sm">
                  Tout voir
                </LinkButton>
              }
            />
            <CardBody className="space-y-2.5">
              {data.polls.length > 0 ? (
                data.polls.map((poll) => (
                  <Link
                    key={poll.id}
                    href={`/sondages#${poll.id}`}
                    className="block rounded-xl border border-[var(--border)] p-3.5 hover:bg-[var(--surface-2)] transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-[13.5px] font-medium text-[var(--text-1)] leading-snug">
                        {poll.title}
                      </p>
                      {poll.hasVoted ? (
                        <Badge tone="success">Vote</Badge>
                      ) : (
                        <Badge tone="warning">A voter</Badge>
                      )}
                    </div>
                    <p className="mt-1.5 text-[12px] text-[var(--text-3)]">
                      Clôture {formatRelative(poll.endsAt)} · {poll._count.votes} vote
                      {poll._count.votes > 1 ? 's' : ''}
                    </p>
                  </Link>
                ))
              ) : (
                <EmptyState
                  icon={<IconPoll />}
                  title="Aucun sondage"
                  description="Aucune consultation en cours."
                />
              )}
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  )
}

function Greeting({ firstName, className }: { firstName: string; className?: string | null }) {
  const hour = new Date().getHours()
  const salutation = hour < 18 ? 'Bonjour' : 'Bonsoir'
  return (
    <div className="mb-5">
      <h1 className="text-[22px] sm:text-[26px] font-semibold tracking-[-0.02em] text-[var(--text-1)]">
        {salutation}, {firstName} <span aria-hidden="true">👋</span>
      </h1>
      <p className="text-[13.5px] text-[var(--text-3)] mt-1">
        {className
          ? `Voici l’essentiel pour ${className} aujourd’hui.`
          : "Voici l essentiel de votre journee."}
      </p>
    </div>
  )
}

function DelegatePanel({
  data,
}: {
  data: NonNullable<Awaited<ReturnType<typeof getDelegateDashboard>>>
}) {
  const actions = [
    { href: '/ressources?nouveau=1', label: 'Ajouter une ressource', icon: IconFolder },
    { href: '/annonces?nouveau=1', label: 'Publier une annonce', icon: IconMegaphone },
    { href: '/programme?nouveau=1', label: 'Ajouter une séance', icon: IconCalendar },
    { href: '/echeances?nouveau=1', label: 'Ajouter une échéance', icon: IconClock },
    { href: '/sondages?nouveau=1', label: 'Créer un sondage', icon: IconPoll },
  ]

  return (
    <div className="mb-5 space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        <StatTile
          label="Etudiants"
          value={data.studentCount}
          tone="accent"
          icon={<IconUsers className="size-4" />}
        />
        <StatTile
          label="Ressources / 7j"
          value={data.newResources}
          tone="info"
          icon={<IconFolder className="size-4" />}
        />
        <StatTile
          label="Annonces actives"
          value={data.activeAnnouncements}
          tone="warning"
          icon={<IconMegaphone className="size-4" />}
        />
        <StatTile
          label="Échéances / 7j"
          value={data.upcomingDeadlines}
          tone="danger"
          icon={<IconClock className="size-4" />}
        />
        <StatTile
          label="Sondages ouverts"
          value={data.activePolls}
          tone="success"
          icon={<IconPoll className="size-4" />}
        />
        <StatTile
          label="Réclamations"
          value={data.pendingComplaints}
          hint="en attente"
          tone={data.pendingComplaints > 0 ? 'danger' : 'neutral'}
          icon={<IconComplaint className="size-4" />}
        />
      </div>

      <Card>
        <CardHeader title="Actions rapides" description="Publier en quelques secondes" />
        <CardBody className="flex flex-wrap gap-2">
          {actions.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="inline-flex items-center gap-2 rounded-lg border border-[var(--border-strong)] bg-[var(--surface-1)] px-3 py-2 text-[13px] font-medium text-[var(--text-2)] hover:bg-[var(--surface-3)] hover:text-[var(--text-1)] transition-colors"
            >
              <IconPlus className="size-3.5 text-[var(--accent)]" />
              <Icon className="size-4 text-[var(--text-3)]" />
              {label}
            </Link>
          ))}
        </CardBody>
      </Card>

      {data.recentActivity.length > 0 ? (
        <Card>
          <CardHeader
            title="Activite recente"
            description="Dernieres actions sur la classe"
            action={
              <LinkButton href="/admin/audit" variant="ghost" size="sm">
                Journal complet
              </LinkButton>
            }
          />
          <CardBody>
            <ul className="space-y-2.5">
              {data.recentActivity.map((item) => (
                <li key={item.id} className="flex items-start gap-2.5">
                  <span className="mt-1.5 size-1.5 rounded-full bg-[var(--accent)] shrink-0" />
                  <p className="text-[13px] text-[var(--text-2)] leading-relaxed">
                    {item.summary}{' '}
                    <span className="text-[var(--text-3)]">
                      {formatRelative(item.createdAt)}
                    </span>
                  </p>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      ) : null}
    </div>
  )
}
