'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import { resetPasswordAction } from '@/app/actions/auth'
import { emptyActionState } from '@/lib/errors'
import { Field, Input } from '@/components/ui/field'
import { SubmitButton } from '@/components/ui/submit-button'
import { Alert } from '@/components/ui/feedback'
import { buttonClasses } from '@/components/ui/button'

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, formAction] = useActionState(resetPasswordAction, emptyActionState)

  if (state.ok) {
    return (
      <div className="space-y-4">
        <Alert tone="success">{state.message}</Alert>
        <Link href="/login?reason=reset" className={buttonClasses('primary', 'lg', 'w-full')}>
          Aller a la connexion
        </Link>
      </div>
    )
  }

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      {state.message ? <Alert tone="danger">{state.message}</Alert> : null}

      <Field
        label="Nouveau mot de passe"
        htmlFor="password"
        error={state.fieldErrors?.password}
        hint="10 caracteres minimum, avec majuscule, minuscule et chiffre"
        required
      >
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
        />
      </Field>

      <Field
        label="Confirmer le mot de passe"
        htmlFor="confirmPassword"
        error={state.fieldErrors?.confirmPassword}
        required
      >
        <Input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
        />
      </Field>

      <SubmitButton className="w-full" size="lg" pendingLabel="Mise a jour...">
        Definir le mot de passe
      </SubmitButton>
    </form>
  )
}
