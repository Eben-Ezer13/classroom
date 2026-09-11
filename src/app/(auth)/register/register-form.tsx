'use client'

import { registerAction } from '@/app/actions/auth'
import { Field, Input } from '@/components/ui/field'
import { SubmitButton } from '@/components/ui/submit-button'
import { Alert } from '@/components/ui/feedback'
import { useFormAction } from '@/components/ui/use-form-action'

export function RegisterForm({
  defaultClassCode,
  next,
}: {
  defaultClassCode: string | null
  next: string | null
}) {
  const { state, formAction, value } = useFormAction(registerAction)
  const accountType = value('accountType', 'ETUDIANT')

  return (
    <form action={formAction} className="space-y-4">
      {next ? <input type="hidden" name="next" value={next} /> : null}
      {state.message && !state.ok ? <Alert tone="danger">{state.message}</Alert> : null}

      <div className="grid grid-cols-2 gap-3">
        <Field label="Prénom" htmlFor="firstName" error={state.fieldErrors?.firstName} required>
          <Input
            id="firstName"
            name="firstName"
            autoComplete="given-name"
            defaultValue={value('firstName')}
            maxLength={60}
            required
          />
        </Field>
        <Field label="Nom" htmlFor="lastName" error={state.fieldErrors?.lastName} required>
          <Input
            id="lastName"
            name="lastName"
            autoComplete="family-name"
            defaultValue={value('lastName')}
            maxLength={60}
            required
          />
        </Field>
      </div>

      <Field label="Adresse email" htmlFor="email" error={state.fieldErrors?.email} required>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          defaultValue={value('email')}
          maxLength={180}
          required
        />
      </Field>

      <fieldset className="space-y-2">
        <legend className="text-[13px] font-medium text-[var(--text-1)]">
          Type de compte
        </legend>
        <div className="grid sm:grid-cols-2 gap-3">
          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-1)] p-3 transition-colors has-[:checked]:border-[var(--accent)] has-[:checked]:bg-[var(--accent-soft)]">
            <input
              type="radio"
              name="accountType"
              value="ETUDIANT"
              defaultChecked={accountType !== 'DELEGUE'}
              className="mt-0.5 accent-[var(--accent)]"
            />
            <span>
              <span className="block text-[13px] font-medium text-[var(--text-1)]">Étudiant</span>
              <span className="mt-0.5 block text-[12px] text-[var(--text-3)]">
                Rejoindre une classe avec un code.
              </span>
            </span>
          </label>
          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-1)] p-3 transition-colors has-[:checked]:border-[var(--accent)] has-[:checked]:bg-[var(--accent-soft)]">
            <input
              type="radio"
              name="accountType"
              value="DELEGUE"
              defaultChecked={accountType === 'DELEGUE'}
              className="mt-0.5 accent-[var(--accent)]"
            />
            <span>
              <span className="block text-[13px] font-medium text-[var(--text-1)]">Délégué</span>
              <span className="mt-0.5 block text-[12px] text-[var(--text-3)]">
                Créer et administrer une classe.
              </span>
            </span>
          </label>
        </div>
      </fieldset>

      <div className="grid grid-cols-2 gap-3">
        <Field
          label="Code de la classe"
          htmlFor="classCode"
          error={state.fieldErrors?.classCode}
          hint="Facultatif pour un délégué"
        >
          <Input
            id="classCode"
            name="classCode"
            placeholder="GSMI4A"
            defaultValue={value('classCode', defaultClassCode)}
            className="uppercase"
            maxLength={40}
          />
        </Field>
        <Field
          label="Numéro étudiant"
          htmlFor="studentId"
          error={state.fieldErrors?.studentId}
          hint="Facultatif"
        >
          <Input
            id="studentId"
            name="studentId"
            placeholder="20260145"
            defaultValue={value('studentId')}
            maxLength={40}
          />
        </Field>
      </div>

      <Field
        label="Mot de passe"
        htmlFor="password"
        error={state.fieldErrors?.password}
        hint="10 caractères minimum, avec majuscule, minuscule et chiffre"
        required
      >
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={10}
          maxLength={128}
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

      <SubmitButton className="w-full" size="lg" pendingLabel="Création...">
        Créer mon compte
      </SubmitButton>
    </form>
  )
}
