import type { Metadata } from 'next'
import Link from 'next/link'
import { requirePageUser } from '@/lib/auth/guards'
import { resolveJoinCode } from '@/lib/services/classes'
import { joinClassFormAction } from '@/app/actions/classes'
import { AppError } from '@/lib/errors'
import { PageHeader } from '@/components/layout/page-header'
import { Card, CardBody } from '@/components/ui/card'
import { Alert } from '@/components/ui/feedback'
import { Field, Input } from '@/components/ui/field'
import { SubmitButton } from '@/components/ui/submit-button'
import { LinkButton } from '@/components/ui/button'

export const metadata: Metadata = { title: 'Rejoindre une classe' }

/**
 * Ecran d'atterrissage d'un lien d'invitation.
 * Le code est résolu côté serveur AVANT d’être proposé : l’étudiant voit
 * quelle classe il s’apprête à rejoindre, et une invitation expirée donne
 * un message clair plutot qu'un echec technique.
 */
export default async function JoinPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>
}) {
  const user = await requirePageUser()
  const params = await searchParams
  const code = (params.code ?? '').trim().toUpperCase()

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
        description="Verifiez la classe avant de confirmer votre adhesion."
      />

      <Card>
        <CardBody className="space-y-4">
          {error ? <Alert tone="danger">{error}</Alert> : null}

          {className && !error ? (
            alreadyMember ? (
              <>
                <Alert tone="info">
                  Vous etes deja membre de <strong>{className}</strong>.
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

          {!alreadyMember ? (
            <form action={joinClassFormAction} className="space-y-4">
              <Field label="Code d’invitation" htmlFor="code" required>
                <Input
                  id="code"
                  name="code"
                  required
                  defaultValue={code}
                  placeholder="A1B2C3D4"
                  className="uppercase tracking-[0.15em] font-mono"
                  maxLength={40}
                />
              </Field>
              <Field label="Numero etudiant" htmlFor="studentId" hint="Facultatif">
                <Input id="studentId" name="studentId" maxLength={40} />
              </Field>
              <SubmitButton className="w-full" pendingLabel="Adhesion...">
                Rejoindre la classe
              </SubmitButton>
            </form>
          ) : null}

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
