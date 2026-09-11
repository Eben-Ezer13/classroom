'use client'

import { forgotPasswordAction } from '@/app/actions/auth'
import { Field, Input } from '@/components/ui/field'
import { SubmitButton } from '@/components/ui/submit-button'
import { Alert } from '@/components/ui/feedback'
import { useFormAction } from '@/components/ui/use-form-action'

export function ForgotPasswordForm() {
  const { state, formAction, value } = useFormAction(forgotPasswordAction)

  if (state.ok && state.message) {
    return <Alert tone="success">{state.message}</Alert>
  }

  return (
    <form action={formAction} className="space-y-4">
      {state.message && !state.ok ? <Alert tone="danger">{state.message}</Alert> : null}

      <Field label="Adresse email" htmlFor="email" error={state.fieldErrors?.email} required>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          defaultValue={value('email')}
          required
        />
      </Field>

      <SubmitButton className="w-full" size="lg" pendingLabel="Envoi...">
        Envoyer le lien
      </SubmitButton>
    </form>
  )
}
