import type { Metadata } from 'next'
import { requirePageClassAdmin } from '@/lib/auth/guards'
import { getClassProfile } from '@/lib/services/class-context'
import { classMemberStats, classStorage } from '@/lib/services/classes'
import { PageHeader } from '@/components/layout/page-header'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { StatTile } from '@/components/ui/feedback'
import { formatDate, formatFileSize } from '@/lib/utils'
import { ClassSettingsForm } from './settings-form'

export const metadata: Metadata = { title: 'Paramètres de la classe' }

export default async function ClassSettingsPage() {
  const { classId } = await requirePageClassAdmin()
  const [profile, members, storage] = await Promise.all([
    getClassProfile(classId),
    classMemberStats(classId),
    classStorage(classId),
  ])

  if (!profile) return null

  const percent =
    storage.quota > 0 ? Math.min(100, Math.round((storage.used / storage.quota) * 100)) : 0

  return (
    <>
      <PageHeader
        title="Paramètres de la classe"
        description="Identite de l espace, visible par tous ses membres."
        breadcrumb={[{ label: 'Administration', href: '/admin' }, { label: 'Paramètres' }]}
      />

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader title="Identite" />
            <CardBody>
              <ClassSettingsForm
                defaults={{
                  name: profile.name,
                  schoolName: profile.schoolName,
                  programName: profile.programName ?? '',
                  levelName: profile.levelName ?? '',
                  description: profile.description ?? '',
                }}
              />
            </CardBody>
          </Card>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <StatTile label="Membres" value={members.total} tone="accent" />
            <StatTile label="Delegues" value={members.admins} tone="info" />
          </div>

          <Card>
            <CardHeader title="Stockage de la classe" />
            <CardBody className="space-y-2">
              <div className="h-2 rounded-full bg-[var(--surface-3)] overflow-hidden">
                <div
                  className="h-full bg-[var(--accent)]"
                  style={{ width: `${percent}%` }}
                />
              </div>
              <p className="text-[13px] text-[var(--text-2)]">
                {formatFileSize(storage.used)} utilises sur {formatFileSize(storage.quota)}{' '}
                ({percent}%)
              </p>
              <p className="text-[12.5px] text-[var(--text-3)] leading-relaxed">
                Le quota est propre a votre classe : les fichiers des autres classes ne
                l entament pas, et vos ressources ne sont accessibles qu a vos membres.
              </p>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Informations" />
            <CardBody className="space-y-1.5 text-[13px] text-[var(--text-2)]">
              <p>
                Code d inscription :{' '}
                <code className="font-mono tracking-wider">{profile.code}</code>
              </p>
              <p>Creee le {formatDate(profile.createdAt)}</p>
              {profile.createdBy ? (
                <p>
                  Delegue principal : {profile.createdBy.firstName}{' '}
                  {profile.createdBy.lastName}
                </p>
              ) : null}
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  )
}
