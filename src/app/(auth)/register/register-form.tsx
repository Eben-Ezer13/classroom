'use client'

import { registerAction } from '@/app/actions/auth'
import { Field, Input } from '@/components/ui/field'
import { PasswordInput } from '@/components/ui/password-input'
import { SubmitButton } from '@/components/ui/submit-button'
import { Alert } from '@/components/ui/feedback'
import { IconGraduation } from '@/components/ui/icons'
import { useFormAction } from '@/components/ui/use-form-action'

export function RegisterForm({
  defaultClassCode,
  next,
  targetClass,
  codeError,
}: {
  defaultClassCode: string | null
  next: string | null
  targetClass?: {
    className: string
    schoolName: string
    role?: string
  } | null
  codeError?: string | null
}) {
  const { state, formAction, value } = useFormAction(registerAction)
  const accountType = value('accountType', 'ETUDIANT')

  return (
    <form action={formAction} className="space-y-4">
      {next ? <input type="hidden" name="next" value={next} /> : null}
      {state.message && !state.ok ? <Alert tone="danger">{state.message}</Alert> : null}

      {/* Bannière de confirmation de la classe ciblée */}
      {targetClass ? (
        <div className="rounded-2xl border border-[var(--accent-border)] bg-[var(--accent-soft)] p-3.5 flex items-start gap-3">
          <span className="size-8 rounded-lg bg-[var(--accent)] text-[var(--accent-contrast)] grid place-items-center shrink-0 mt-0.5">
            <IconGraduation className="size-[18px]" />
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--accent-strong)]">
              Classe invitée
            </p>
            <p className="text-[14px] font-bold text-[var(--text-1)] truncate">
              {targetClass.className}
            </p>
            <p className="text-[12px] text-[var(--text-2)] truncate">
              {targetClass.schoolName}
            </p>
          </div>
        </div>
      ) : codeError ? (
        <Alert tone="danger">{codeError}</Alert>
      ) : null}

      {/* Si invité avec une classe, verrouiller le rôle Étudiant et le code */}
      {targetClass ? (
        <>
          <input type="hidden" name="accountType" value="ETUDIANT" />
          <input type="hidden" name="classCode" value={defaultClassCode ?? ''} />
        </>
      ) : null}

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

      {!targetClass ? (
        <>
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
        </>
      ) : (
        <Field
          label="Numéro étudiant"
          htmlFor="studentId"
          error={state.fieldErrors?.studentId}
          hint="Facultatif (propre à votre classe)"
        >
          <Input
            id="studentId"
            name="studentId"
            placeholder="Ex : 20260145"
            defaultValue={value('studentId')}
            maxLength={40}
          />
        </Field>
      )}

      <Field
        label="Mot de passe"
        htmlFor="password"
        error={state.fieldErrors?.password}
        hint="10 caractères minimum, avec majuscule, minuscule et chiffre"
        required
      >
        <PasswordInput
          id="password"
          name="password"
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
        <PasswordInput
          id="confirmPassword"
          name="confirmPassword"
          autoComplete="new-password"
          required
        />
      </Field>

      <SubmitButton className="w-full" size="lg" pendingLabel="Création du compte...">
        {targetClass ? 'Créer mon compte et rejoindre la classe' : 'Créer mon compte'}
      </SubmitButton>
    </form>
  )
}
