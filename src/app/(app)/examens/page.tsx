import type { Metadata } from 'next'
import { requirePageUser } from '@/lib/auth/guards'
import { prisma } from '@/lib/db'
import { getClassModules } from '@/lib/services/class-context'
import { PageHeader } from '@/components/layout/page-header'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/feedback'
import { NoClassState } from '@/components/ui/no-class'
import { ExamCountdown } from '@/components/features/exam-countdown'
import { canManageArea } from '@/lib/permissions'
import { formatDateTime } from '@/lib/utils'
import { ExamForm, DeleteExamButton } from './exam-controls'

export const metadata: Metadata = { title: 'Examens' }

export default async function ExamsPage() {
  const user = await requirePageUser()
  if (!user.classGroupId) return <><PageHeader title="Examens" /><NoClassState /></>
  const [exams, modules] = await Promise.all([
    prisma.exam.findMany({ where: { classGroupId: user.classGroupId, deletedAt: null, startsAt: { gte: new Date() } }, select: { id: true, title: true, startsAt: true, module: { select: { code: true, name: true } } }, orderBy: { startsAt: 'asc' }, take: 100 }),
    getClassModules(user.classGroupId),
  ])
  const canManage = canManageArea(user, user.classGroupId, 'ECHEANCES')
  return <>
    <PageHeader title="Examens" description="Dates à venir et compte à rebours permanent." />
    {canManage ? <Card className="mb-4"><CardHeader title="Ajouter une date d’examen" description="Les rappels de compte à rebours sont envoyés à 08 h 30, 18 h 30 et 22 h, heure du Maroc." /><CardBody><ExamForm modules={modules.map(({ id, code, name }) => ({ id, code, name }))} /></CardBody></Card> : null}
    <Card>
      {exams.length === 0 ? <EmptyState title="Aucun examen programmé" description={canManage ? 'Ajoutez une date pour afficher le compte à rebours et programmer les rappels.' : 'Aucune date d’examen à venir pour le moment.'} /> : <CardBody className="space-y-3">
        {exams.map((exam) => <div key={exam.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-1)] p-4">
          <div><p className="font-medium text-[var(--text-1)]">{exam.title}</p><p className="mt-1 text-sm text-[var(--text-3)]">{exam.module ? `${exam.module.code} · ${exam.module.name} · ` : ''}{formatDateTime(exam.startsAt)}</p></div>
          <div className="flex items-center gap-3 text-right"><span className="text-sm font-semibold text-[var(--accent-strong)]"><ExamCountdown startsAt={exam.startsAt.toISOString()} /></span>{canManage ? <DeleteExamButton examId={exam.id} /> : null}</div>
        </div>)}
      </CardBody>}
    </Card>
  </>
}
