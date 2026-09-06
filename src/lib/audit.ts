import 'server-only'
import { headers } from 'next/headers'
import { prisma } from '@/lib/db'
import type { SessionUser } from '@/lib/auth/session'
import type { Prisma } from '@prisma/client'

/**
 * Journal des actions sensibles.
 *
 * L'ecriture ne doit jamais faire echouer l'action metier : si le journal
 * tombe, la publication d'une annonce reste valide. On avale donc l'erreur
 * apres l'avoir tracee.
 */

type AuditInput = {
  actor: SessionUser
  action: string
  entityType: string
  entityId?: string | null
  entityLabel?: string | null
  classGroupId?: string | null
  summary: string
  metadata?: Prisma.InputJsonValue
}

export async function recordAudit(input: AuditInput): Promise<void> {
  try {
    const h = await headers()
    const forwarded = h.get('x-forwarded-for')
    await prisma.auditLog.create({
      data: {
        actorId: input.actor.id,
        actorLabel: `${input.actor.firstName} ${input.actor.lastName}`,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId ?? null,
        entityLabel: input.entityLabel ?? null,
        classGroupId: input.classGroupId ?? null,
        summary: input.summary,
        metadata: input.metadata,
        ip: forwarded ? forwarded.split(',')[0].trim() : null,
      },
    })
  } catch (error) {
    console.error('[audit] echec ecriture journal', error)
  }
}

/** Construit un resume lisible : "Jean Dupont a ajoute une ressource." */
export function auditSummary(
  actor: SessionUser,
  verb: string,
  what: string,
): string {
  return `${actor.firstName} ${actor.lastName} ${verb} ${what}.`
}
