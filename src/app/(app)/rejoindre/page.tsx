import type { Metadata } from 'next'
import Link from 'next/link'
import { requirePageUser } from '@/lib/auth/guards'
import { resolveJoinCode } from '@/lib/services/classes'
import { AppError } from '@/lib/errors'
import { PageHeader } from '@/components/layout/page-header'
import { Card, CardBody } from '@/components/ui/card'
import { Alert } from '@/components/ui/feedback'
import { LinkButton } from '@/components/ui/button'
import { JoinClassForm } from '../classes/class-forms'

export const metadata: Metadata = { title: 'Rejoindre une classe' }

/**
 * Ecran d'atterrissage d'un lien d'invitation.
 * Le code est résolu côté serveur AVANT d’être proposé : l’étudiant voit
 * quelle classe il s’apprête à rejoindre, et une invitation expirée donne
 * un message clair plutôt qu'un échec technique.
 */
export default async function JoinPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>
}) {
  const user = await requirePageUser()
  const params = await searchParams
  const code = (params.code ?? '').trim().toUpperCase().slice(0, 40)

  let className: string | null = null
  let schoolName: string | null = null
  let alreadyMember = false
  let error: string | null = null

  if (code) {
    try {
      const target = await resolveJoinCode(code)
      className = target.className
      schoolName = target.schoolName
      alreadyMember = user.memberships.some(
        (m) => m.classGroupId === target.classGroupId,
      )
    } catch (caught) {
      error =
        caught instanceof AppError
          ? caught.message
          : "Ce lien d'invitation n'est pas valide."
    }
  }

  return (
    <div className="max-w-lg mx-auto">
      <PageHeader
        title="Rejoindre une classe"
        description="Vérifiez la classe avant de confirmer votre adhésion."
      />

      <Card>
        <CardBody className="space-y-4">
          {error ? <Alert tone="danger">{error}</Alert> : null}

          {className && !error ? (
            alreadyMember ? (
              <>
                <Alert tone="info">
                  Vous êtes déjà membre de <strong>{className}</strong>.
                </Alert>
                <LinkButton href="/dashboard" className="w-full">
                  Ouvrir la classe
                </LinkButton>
              </>
            ) : (
              <Alert tone="success">
                Invitation valide pour <strong>{className}</strong>
                {schoolName ? ` — ${schoolName}` : ''}.
              </Alert>
            )
          ) : null}

          {!alreadyMember ? <JoinClassForm defaultCode={code} variant="primary" /> : null}

          <p className="text-[12.5px] text-[var(--text-3)] text-center">
            <Link href="/classes" className="text-[var(--accent)] hover:underline">
              Voir toutes mes classes
            </Link>
          </p>
        </CardBody>
      </Card>
    </div>
  )
}
