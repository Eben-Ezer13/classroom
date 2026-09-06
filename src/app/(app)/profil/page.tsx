import type { Metadata } from 'next'
import { requirePageUser } from '@/lib/auth/guards'
import { prisma } from '@/lib/db'
import { PageHeader } from '@/components/layout/page-header'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar } from '@/components/ui/avatar'
import { StatTile } from '@/components/ui/feedback'
import { CLASS_ROLE_LABELS } from '@/lib/constants'
import { formatDate, formatRelative } from '@/lib/utils'
import { AvatarForm, PasswordForm, ProfileForm } from './profile-forms'

export const metadata: Metadata = { title: 'Mon profil' }

export default async function ProfilePage() {
  const user = await requirePageUser()

  const [profile, stats] = await Promise.all([
    prisma.user.findUnique({
      where: { id: user.id },
      select: {
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        studentId: true,
        avatarUrl: true,
        createdAt: true,
        lastLoginAt: true,
      },
    }),
    Promise.all([
      prisma.download.count({ where: { userId: user.id } }),
      prisma.pollVote.findMany({
        where: { userId: user.id },
        select: { pollId: true },
        distinct: ['pollId'],
      }),
      prisma.complaint.count({ where: { authorId: user.id, deletedAt: null } }),
      prisma.session.count({ where: { userId: user.id, expiresAt: { gte: new Date() } } }),
    ]),
  ])

  if (!profile) return null
  const [downloads, votes, complaints, sessions] = stats

  return (
    <>
      <PageHeader title="Mon profil" description="Vos informations et votre sécurité." />

      <div className="grid lg:grid-cols-[300px_1fr] gap-4">
        <div className="space-y-4">
          <Card>
            <CardBody className="flex flex-col items-center text-center py-7">
              <Avatar
                firstName={profile.firstName}
                lastName={profile.lastName}
                src={profile.avatarUrl ? `/api/users/${user.id}/avatar` : null}
                size="xl"
              />
              <p className="mt-3.5 text-[17px] font-semibold text-[var(--text-1)]">
                {profile.firstName} {profile.lastName}
              </p>
              <p className="text-[13px] text-[var(--text-3)]">{profile.email}</p>
              <div className="mt-3">
                <Badge tone={user.role === 'ADMIN' ? 'accent' : 'neutral'}>
                  {CLASS_ROLE_LABELS[user.role]}
                </Badge>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Classe active"
              description="Le numéro étudiant est propre à chaque classe."
            />
            <CardBody className="space-y-3">
              <Row label="Établissement" value={user.schoolName ?? '—'} />
              <Row label="Filière" value={user.programName ?? '—'} />
              <Row label="Niveau" value={user.levelName ?? '—'} />
              <Row
                label="Classe"
                value={
                  user.className ? `${user.className} (${user.classCode ?? ''})` : '—'
                }
              />
              <Row label="Rôle" value={CLASS_ROLE_LABELS[user.role]} />
              <Row label="Numéro étudiant" value={user.studentId ?? '—'} />
              <Row label="Classes rejointes" value={String(user.memberships.length)} />
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Photo de profil" />
            <CardBody>
              <AvatarForm />
            </CardBody>
          </Card>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatTile label="Telechargements" value={downloads} tone="accent" />
            <StatTile label="Sondages" value={votes.length} tone="info" />
            <StatTile label="Reclamations" value={complaints} tone="warning" />
            <StatTile label="Sessions actives" value={sessions} tone="success" />
          </div>

          <Card>
            <CardHeader
              title="Informations personnelles"
              description={`Compte cree le ${formatDate(profile.createdAt)}${
                profile.lastLoginAt
                  ? ` · derniere connexion ${formatRelative(profile.lastLoginAt)}`
                  : ''
              }`}
            />
            <CardBody>
              <ProfileForm
                defaults={{
                  firstName: profile.firstName,
                  lastName: profile.lastName,
                  phone: profile.phone,
                  studentId: profile.studentId,
                }}
              />
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Securite"
              description="Changez votre mot de passe regulierement."
            />
            <CardBody>
              <PasswordForm />
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
