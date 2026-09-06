'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/db'
import { requireClassAdmin, requireUser } from '@/lib/auth/guards'
import {
  assertCanManageClass,
  canViewClass,
  requireManagedClassId,
} from '@/lib/permissions'
import { recordAudit } from '@/lib/audit'
import { notifyClass } from '@/lib/notifications'
import { runAction, AppError, NotFoundError, type ActionState } from '@/lib/errors'
import { parseForm, pollSchema, voteSchema } from '@/lib/validation'
import { formatDateShort } from '@/lib/utils'

export async function createPollAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    const { user } = await requireClassAdmin()
    // `options` arrive sous forme de champs repetes : parseForm les regroupe.
    const parsed = parseForm(pollSchema, formData, ['options'])
    if (!parsed.success) {
      return { ok: false, message: parsed.message, fieldErrors: parsed.fieldErrors }
    }
    const data = parsed.data
    const classGroupId = requireManagedClassId(user, data.classGroupId)

    if (data.endsAt.getTime() <= Date.now()) {
      return {
        ok: false,
        message: 'La date de cloture doit etre dans le futur.',
        fieldErrors: { endsAt: ['Date de cloture deja passee.'] },
      }
    }

    const poll = await prisma.poll.create({
      data: {
        classGroupId,
        title: data.title,
        description: data.description ?? null,
        allowMultiple: data.allowMultiple,
        isAnonymous: data.isAnonymous,
        endsAt: data.endsAt,
        createdById: user.id,
        options: {
          create: data.options.map((label, index) => ({ label, position: index })),
        },
      },
      select: { id: true, title: true, endsAt: true },
    })

    await recordAudit({
      actor: user,
      action: 'POLL_CREATED',
      entityType: 'Poll',
      entityId: poll.id,
      entityLabel: poll.title,
      classGroupId,
      summary: `${user.firstName} ${user.lastName} a cree le sondage ${poll.title}.`,
    })

    await notifyClass(
      classGroupId,
      {
        type: 'SONDAGE',
        title: 'Nouveau sondage',
        body: `${poll.title} — a repondre avant le ${formatDateShort(poll.endsAt)}.`,
        url: '/sondages',
        entityType: 'Poll',
        entityId: poll.id,
      },
      { excludeUserId: user.id },
    )

    revalidatePath('/sondages')
    revalidatePath('/dashboard')
    return { ok: true, message: 'Sondage cree.' }
  })
}

export async function voteAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    const user = await requireUser()
    const parsed = parseForm(voteSchema, formData, ['optionIds'])
    if (!parsed.success) {
      return { ok: false, message: parsed.message, fieldErrors: parsed.fieldErrors }
    }
    const { pollId, optionIds } = parsed.data

    const poll = await prisma.poll.findFirst({
      where: { id: pollId, deletedAt: null },
      select: {
        id: true,
        classGroupId: true,
        allowMultiple: true,
        startsAt: true,
        endsAt: true,
        closedAt: true,
        options: { select: { id: true } },
      },
    })
    if (!poll || !canViewClass(user, poll.classGroupId)) {
      throw new NotFoundError('Sondage introuvable.')
    }

    const now = Date.now()
    if (poll.closedAt) throw new AppError('Ce sondage est clos.')
    if (poll.startsAt.getTime() > now) throw new AppError("Ce sondage n'est pas encore ouvert.")
    if (poll.endsAt.getTime() < now) throw new AppError('Ce sondage est termine.')

    if (!poll.allowMultiple && optionIds.length > 1) {
      throw new AppError('Ce sondage n autorise qu une seule reponse.')
    }

    // Les options doivent appartenir a CE sondage : sinon on pourrait voter
    // pour l'option d'un autre sondage en modifiant le formulaire.
    const validIds = new Set(poll.options.map((o) => o.id))
    if (optionIds.some((id) => !validIds.has(id))) {
      throw new AppError('Option de vote invalide.')
    }

    await prisma.$transaction(async (tx) => {
      const already = await tx.pollVote.count({ where: { pollId, userId: user.id } })
      if (already > 0) {
        throw new AppError('Vous avez deja participe a ce sondage.')
      }

      await tx.pollVote.createMany({
        data: optionIds.map((optionId) => ({ pollId, optionId, userId: user.id })),
      })

      // Second controle DANS la transaction : deux soumissions simultanees
      // passeraient toutes deux le premier test, mais la seconde verrait ici
      // un total incoherent et provoquerait l'annulation de son insertion.
      const total = await tx.pollVote.count({ where: { pollId, userId: user.id } })
      if (total !== optionIds.length) {
        throw new AppError('Vote deja enregistre.')
      }
    })

    revalidatePath('/sondages')
    revalidatePath('/dashboard')
    return { ok: true, message: 'Vote enregistre.' }
  })
}

export async function closePollAction(formData: FormData): Promise<void> {
  const { user } = await requireClassAdmin()
  const pollId = String(formData.get('pollId') ?? '')

  const poll = await prisma.poll.findFirst({
    where: { id: pollId, deletedAt: null },
    select: { id: true, classGroupId: true, title: true, closedAt: true },
  })
  if (!poll) throw new NotFoundError('Sondage introuvable.')
  assertCanManageClass(user, poll.classGroupId)

  await prisma.poll.update({
    where: { id: pollId },
    data: { closedAt: poll.closedAt ? null : new Date() },
  })

  await recordAudit({
    actor: user,
    action: poll.closedAt ? 'POLL_REOPENED' : 'POLL_CLOSED',
    entityType: 'Poll',
    entityId: poll.id,
    entityLabel: poll.title,
    classGroupId: poll.classGroupId,
    summary: `${user.firstName} ${user.lastName} a ${
      poll.closedAt ? 'rouvert' : 'clos'
    } le sondage ${poll.title}.`,
  })

  revalidatePath('/sondages')
}

export async function deletePollAction(formData: FormData): Promise<void> {
  const { user } = await requireClassAdmin()
  const pollId = String(formData.get('pollId') ?? '')

  const poll = await prisma.poll.findFirst({
    where: { id: pollId, deletedAt: null },
    select: { id: true, classGroupId: true, title: true },
  })
  if (!poll) throw new NotFoundError('Sondage introuvable.')
  assertCanManageClass(user, poll.classGroupId)

  await prisma.poll.update({
    where: { id: pollId },
    data: { deletedAt: new Date() },
  })

  await recordAudit({
    actor: user,
    action: 'POLL_DELETED',
    entityType: 'Poll',
    entityId: poll.id,
    entityLabel: poll.title,
    classGroupId: poll.classGroupId,
    summary: `${user.firstName} ${user.lastName} a supprime le sondage ${poll.title}.`,
  })

  revalidatePath('/sondages')
  revalidatePath('/dashboard')
}
