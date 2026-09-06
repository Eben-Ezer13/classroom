import type { Metadata } from 'next'
import { requirePageClassAdmin } from '@/lib/auth/guards'
import { getClassYears } from '@/lib/services/class-context'
import { PageHeader } from '@/components/layout/page-header'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/feedback'
import { Badge } from '@/components/ui/badge'
import { ConfirmForm, IconSubmit } from '@/components/ui/confirm-form'
import { IconArchive, IconCheck, IconLayers } from '@/components/ui/icons'
import { formatDate } from '@/lib/utils'
import {
  setCurrentSemesterAction,
  setCurrentYearAction,
  toggleYearArchiveAction,
} from '@/app/actions/admin'
import { AddSemesterButton, AddYearButton } from '../admin-forms'

export const metadata: Metadata = { title: 'Années et semestres' }

export default async function AdminYearsPage() {
  // Le calendrier appartient a la classe : la lecture comme l'ecriture
  // sont bornees a l'espace du delegue connecte.
  const { user, classId } = await requirePageClassAdmin()
  const years = await getClassYears(classId)

  return (
    <>
      <PageHeader
        title="Années et semestres"
        description={`Calendrier de ${user.className ?? 'votre classe'}. L’année et le semestre courants servent de valeurs par défaut partout.`}
        breadcrumb={[{ label: 'Administration', href: '/admin' }, { label: 'Années' }]}
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <AddYearButton />
            {years.length > 0 ? (
              <AddSemesterButton
                years={years.map((y) => ({ id: y.id, label: y.label }))}
              />
            ) : null}
          </div>
        }
      />

      {years.length === 0 ? (
        <Card>
          <EmptyState
            icon={<IconLayers />}
            title="Aucune année académique"
            description="Créez une année académique puis ses semestres."
          />
        </Card>
      ) : (
        <div className="space-y-4">
          {years.map((year) => (
            <Card key={year.id} className={year.isArchived ? 'opacity-75' : undefined}>
              <CardHeader
                title={
                  <span className="flex items-center gap-2 flex-wrap">
                    {year.label}
                    {year.isCurrent ? <Badge tone="success">Année courante</Badge> : null}
                    {year.isArchived ? <Badge tone="warning">Archivee</Badge> : null}
                  </span>
                }
                description={`${formatDate(year.startsAt)} → ${formatDate(year.endsAt)}`}
                action={
                  <div className="flex items-center gap-0.5">
                    {!year.isCurrent && !year.isArchived ? (
                      <ConfirmForm
                        action={setCurrentYearAction}
                        hidden={{ yearId: year.id }}
                        message={`Définir ${year.label} comme année courante ?`}
                      >
                        <IconSubmit label="Definir comme annee courante">
                          <IconCheck className="size-[17px]" />
                        </IconSubmit>
                      </ConfirmForm>
                    ) : null}
                    <ConfirmForm
                      action={toggleYearArchiveAction}
                      hidden={{ yearId: year.id }}
                      message={
                        year.isArchived
                          ? `Desarchiver ${year.label} et ses semestres ?`
                          : `Archiver ${year.label} ? Ses semestres et ressources seront archives.`
                      }
                    >
                      <IconSubmit label={year.isArchived ? 'Desarchiver' : 'Archiver'}>
                        <IconArchive className="size-[17px]" />
                      </IconSubmit>
                    </ConfirmForm>
                  </div>
                }
              />
              <CardBody>
                {year.semesters.length === 0 ? (
                  <p className="text-[13px] text-[var(--text-3)]">
                    Aucun semestre. Ajoutez-en un pour pouvoir créer des modules.
                  </p>
                ) : (
                  <div className="grid sm:grid-cols-2 gap-2.5">
                    {year.semesters.map((semester) => (
                      <div
                        key={semester.id}
                        className="flex items-start justify-between gap-3 rounded-xl border border-[var(--border)] p-3.5"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[13.5px] font-medium text-[var(--text-1)]">
                              {semester.label}
                            </span>
                            {semester.isCurrent ? (
                              <Badge tone="success">Courant</Badge>
                            ) : null}
                            {semester.isArchived ? <Badge tone="warning">Archive</Badge> : null}
                          </div>
                          <p className="mt-1 text-[12px] text-[var(--text-3)]">
                            {formatDate(semester.startsAt)} → {formatDate(semester.endsAt)}
                          </p>
                          <p className="mt-1 text-[12px] text-[var(--text-3)]">
                            {semester._count.modules} module(s) ·{' '}
                            {semester._count.resources} ressource(s)
                          </p>
                        </div>

                        {!semester.isCurrent && !semester.isArchived ? (
                          <ConfirmForm
                            action={setCurrentSemesterAction}
                            hidden={{ semesterId: semester.id }}
                            message={`Definir ${semester.label} comme semestre courant ?`}
                          >
                            <IconSubmit label="Definir comme semestre courant">
                              <IconCheck className="size-[17px]" />
                            </IconSubmit>
                          </ConfirmForm>
                        ) : null}
                      </div>
                    ))}
                  </div>
                )}
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </>
  )
}
