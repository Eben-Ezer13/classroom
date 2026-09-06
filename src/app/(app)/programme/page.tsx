import type { Metadata } from 'next'
import Link from 'next/link'
import { requirePageUser } from '@/lib/auth/guards'
import { getWeekSchedule, groupByDay } from '@/lib/services/schedule'
import {
  getClassModules,
  getClassSemesters,
  getDefaultSemesterId,
} from '@/lib/services/class-context'
import { PageHeader } from '@/components/layout/page-header'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/feedback'
import { NoClassState } from '@/components/ui/no-class'
import { ScheduleItem } from '@/components/features/schedule-item'
import { IconCalendar } from '@/components/ui/icons'
import { addDays, cn, formatDateShort, formatWeekday, startOfDay } from '@/lib/utils'
import { AddScheduleButton, ScheduleEntryActions } from './schedule-controls'

export const metadata: Metadata = { title: 'Programme' }

const DAY_LABELS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']

export default async function ProgrammePage({
  searchParams,
}: {
  searchParams: Promise<{ semaine?: string; nouveau?: string }>
}) {
  const user = await requirePageUser()
  const params = await searchParams

  if (!user.classGroupId) {
    return (
      <>
        <PageHeader title="Programme" />
        <NoClassState />
      </>
    )
  }

  // Seul le delegue de la classe active peut gerer le contenu.
  const canManage = user.role === 'ADMIN'
  const rawOffset = Number(params.semaine ?? '0')
  const offset = Number.isFinite(rawOffset) ? Math.max(-52, Math.min(52, rawOffset)) : 0

  const [{ monday, sunday, entries }, modules, semesters, defaultSemesterId] =
    await Promise.all([
      getWeekSchedule(user.classGroupId, offset, { includeUnpublished: canManage }),
      getClassModules(user.classGroupId),
      getClassSemesters(user.classGroupId),
      getDefaultSemesterId(user.classGroupId),
    ])

  const byDay = groupByDay(entries)
  const today = startOfDay()
  const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i))

  const moduleOptions = modules.map((m) => ({ id: m.id, code: m.code, name: m.name }))
  const semesterOptions = semesters.map((s) => ({
    id: s.id,
    label: s.label,
    academicYear: { label: s.academicYear.label },
  }))

  return (
    <>
      <PageHeader
        title="Programme"
        description={`Semaine du ${formatDateShort(monday)} au ${formatDateShort(sunday)}`}
        actions={
          canManage ? (
            <AddScheduleButton
              modules={moduleOptions}
              semesters={semesterOptions}
              defaultSemesterId={defaultSemesterId}
              autoOpen={params.nouveau === '1'}
            />
          ) : null
        }
      />

      <Card className="mb-4">
        <CardBody className="flex items-center justify-between gap-3 py-3">
          <WeekLink offset={offset - 1} label="Semaine precedente" />
          <div className="text-center">
            <p className="text-[13.5px] font-medium text-[var(--text-1)]">
              {offset === 0
                ? 'Cette semaine'
                : offset === 1
                  ? 'Semaine prochaine'
                  : offset === -1
                    ? 'Semaine derniere'
                    : `Semaine ${offset > 0 ? '+' : ''}${offset}`}
            </p>
            {offset !== 0 ? (
              <Link
                href="/programme"
                className="text-[12px] text-[var(--accent)] hover:underline underline-offset-2"
              >
                Revenir a cette semaine
              </Link>
            ) : (
              <p className="text-[12px] text-[var(--text-3)]">
                {entries.length} séance{entries.length > 1 ? 's' : ''}
              </p>
            )}
          </div>
          <WeekLink offset={offset + 1} label="Semaine suivante" />
        </CardBody>
      </Card>

      {entries.length === 0 ? (
        <Card>
          <EmptyState
            icon={<IconCalendar />}
            title="Aucune séance cette semaine"
            description={
              canManage
                ? 'Ajoutez une séance pour construire le programme de la classe.'
                : 'Le programme de cette semaine n’a pas encore été publié.'
            }
          />
        </Card>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {days.map((day, index) => {
            const key = day.toISOString().slice(0, 10)
            const dayEntries = byDay.get(key) ?? []
            if (dayEntries.length === 0) return null
            const isToday = day.getTime() === today.getTime()

            return (
              <Card key={key} className={cn(isToday && 'ring-1 ring-[var(--accent-border)]')}>
                <CardHeader
                  title={
                    <span className="flex items-center gap-2">
                      {DAY_LABELS[index]}
                      {isToday ? (
                        <span className="rounded-full bg-[var(--accent)] px-2 py-0.5 text-[10.5px] font-semibold text-[var(--accent-contrast)]">
                          Aujourd’hui
                        </span>
                      ) : null}
                    </span>
                  }
                  description={formatWeekday(day)}
                />
                <CardBody className="space-y-2.5">
                  {dayEntries.map((entry) => (
                    <ScheduleItem
                      key={entry.id}
                      entry={entry}
                      actions={
                        canManage ? (
                          <ScheduleEntryActions
                            entry={{
                              id: entry.id,
                              semesterId: entry.semesterId,
                              moduleId: entry.moduleId,
                              type: entry.type,
                              title: entry.title,
                              date: entry.date,
                              startMinutes: entry.startMinutes,
                              endMinutes: entry.endMinutes,
                              room: entry.room,
                              teacherName: entry.teacherName,
                              note: entry.note,
                              isPublished: entry.isPublished,
                            }}
                            modules={moduleOptions}
                            semesters={semesterOptions}
                            defaultSemesterId={defaultSemesterId}
                          />
                        ) : null
                      }
                    />
                  ))}
                </CardBody>
              </Card>
            )
          })}
        </div>
      )}
    </>
  )
}

function WeekLink({ offset, label }: { offset: number; label: string }) {
  return (
    <Link
      href={offset === 0 ? '/programme' : `/programme?semaine=${offset}`}
      className="rounded-lg border border-[var(--border-strong)] px-3 py-1.5 text-[12.5px] font-medium text-[var(--text-2)] hover:bg-[var(--surface-3)] hover:text-[var(--text-1)] transition-colors"
    >
      {label}
    </Link>
  )
}
