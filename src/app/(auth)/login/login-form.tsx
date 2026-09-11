'use client'

import Link from 'next/link'
import { loginAction } from '@/app/actions/auth'
import { Field, Input } from '@/components/ui/field'
import { SubmitButton } from '@/components/ui/submit-button'
import { Alert } from '@/components/ui/feedback'
import { useFormAction } from '@/components/ui/use-form-action'

export function LoginForm({ notice, next }: { notice: string | null; next: string | null }) {
  const { state, formAction, value } = useFormAction(loginAction)

  return (
    <form action={formAction} className="space-y-4">
      {next ? <input type="hidden" name="next" value={next} /> : null}
      {notice ? <Alert tone="success">{notice}</Alert> : null}
      {state.message && !state.ok ? <Alert tone="danger">{state.message}</Alert> : null}

      <Field label="Adresse email" htmlFor="email" error={state.fieldErrors?.email} required>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          defaultValue={value('email')}
          required
          placeholder="prenom.nom@ecole.fr"
        />
      </Field>

      <Field
        label="Mot de passe"
        htmlFor="password"
        error={state.fieldErrors?.password}
        required
      >
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          placeholder="Votre mot de passe"
        />
      </Field>

      <div className="flex justify-end -mt-1">
        <Link
          href="/forgot-password"
          className="text-[12.5px] text-[var(--text-3)] hover:text-[var(--accent)] transition-colors"
        >
          Mot de passe oublié ?
        </Link>
      </div>

      <SubmitButton className="w-full" size="lg" pendingLabel="Connexion...">
        Se connecter
      </SubmitButton>
    </form>
  )
}
