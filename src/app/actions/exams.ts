'use server'

import { prisma } from '@/lib/db'
import { requireClassAdmin } from '@/lib/auth/guards'
import { assertModuleInClass } from '@/lib/permissions'
import { notifyClass } from '@/lib/notifications'
import { parseForm, examSchema } from '@/lib/validation'
import { runAction, NotFoundError, type ActionState } from '@/lib/errors'

export async function createExamAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const { user, classId } = await requireClassAdmin('ECHEANCES')
    const parsed = parseForm(examSchema, formData)
    if (!parsed.success) return { ok: false, message: parsed.message, fieldErrors: parsed.fieldErrors }
    await assertModuleInClass(parsed.data.moduleId, classId)
    const exam = await prisma.exam.create({
      data: { classGroupId: classId, title: parsed.data.title, moduleId: parsed.data.moduleId ?? null, startsAt: parsed.data.startsAt, createdById: user.id },
      select: { id: true, title: true, startsAt: true },
    })
    await notifyClass(classId, {
      type: 'DEADLINE', title: 'Nouvel examen programmé',
      body: `${exam.title} — ${exam.startsAt.toLocaleString('fr-FR', { timeZone: 'Africa/Casablanca' })}. Des rappels seront envoyés le jour de l’examen.`,
      url: '/examens', entityType: 'Exam', entityId: exam.id,
    }, { excludeUserId: user.id })
    return { ok: true, message: 'Date d’examen ajoutée.' }
  })
}

export async function deleteExamAction(formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const { classId } = await requireClassAdmin('ECHEANCES')
    const id = String(formData.get('examId') ?? '')
    const exam = await prisma.exam.findFirst({ where: { id, classGroupId: classId, deletedAt: null }, select: { id: true } })
    if (!exam) throw new NotFoundError('Examen introuvable.')
    await prisma.exam.update({ where: { id }, data: { deletedAt: new Date() } })
    return { ok: true, message: 'Examen supprimé.' }
  })
}
