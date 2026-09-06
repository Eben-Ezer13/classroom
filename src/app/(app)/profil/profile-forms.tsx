'use client'

import { useActionState } from 'react'
import {
  changePasswordAction,
  updateAvatarAction,
  updateProfileAction,
} from '@/app/actions/auth'
import { emptyActionState } from '@/lib/errors'
import { Field, Input } from '@/components/ui/field'
import { SubmitButton } from '@/components/ui/submit-button'
import { Alert } from '@/components/ui/feedback'
import { AVATAR_MAX_SIZE, AVATAR_MIME_TYPES } from '@/lib/constants'

export function ProfileForm({
  defaults,
}: {
  defaults: {
    firstName: string
    lastName: string
    phone: string | null
    studentId: string | null
  }
}) {
  const [state, formAction] = useActionState(updateProfileAction, emptyActionState)

  return (
    <form action={formAction} className="space-y-4">
      {state.message ? (
        <Alert tone={state.ok ? 'success' : 'danger'}>{state.message}</Alert>
      ) : null}

      <div className="grid sm:grid-cols-2 gap-3">
        <Field label="Prénom" htmlFor="firstName" error={state.fieldErrors?.firstName} required>
          <Input
            id="firstName"
            name="firstName"
            defaultValue={defaults.firstName}
            required
            autoComplete="given-name"
          />
        </Field>
        <Field label="Nom" htmlFor="lastName" error={state.fieldErrors?.lastName} required>
          <Input
            id="lastName"
            name="lastName"
            defaultValue={defaults.lastName}
            required
            autoComplete="family-name"
          />
        </Field>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <Field
          label="Numéro étudiant"
          htmlFor="studentId"
          error={state.fieldErrors?.studentId}
        >
          <Input id="studentId" name="studentId" defaultValue={defaults.studentId ?? ''} />
        </Field>
        <Field label="Telephone" htmlFor="phone" error={state.fieldErrors?.phone}>
          <Input
            id="phone"
            name="phone"
            type="tel"
            defaultValue={defaults.phone ?? ''}
            autoComplete="tel"
          />
        </Field>
      </div>

      <div className="flex justify-end">
        <SubmitButton pendingLabel="Enregistrement...">Enregistrer</SubmitButton>
      </div>
    </form>
  )
}

export function AvatarForm() {
  const [state, formAction] = useActionState(updateAvatarAction, emptyActionState)

  return (
    <form action={formAction} className="space-y-3">
      {state.message ? (
        <Alert tone={state.ok ? 'success' : 'danger'}>{state.message}</Alert>
      ) : null}

      <Field
        label="Nouvelle photo"
        htmlFor="avatar"
        hint={`${AVATAR_MAX_SIZE / 1024 / 1024} Mo maximum · PNG, JPEG ou WEBP`}
      >
        <input
          id="avatar"
          name="avatar"
          type="file"
          required
          accept={AVATAR_MIME_TYPES.join(',')}
          className="w-full text-[13px] text-[var(--text-2)] file:mr-3 file:rounded-lg file:border-0 file:bg-[var(--accent-soft)] file:px-3 file:py-2 file:text-[13px] file:font-medium file:text-[var(--accent-strong)] hover:file:brightness-95 cursor-pointer"
        />
      </Field>

      <SubmitButton size="sm" variant="secondary" pendingLabel="Envoi...">
        Mettre à jour la photo
      </SubmitButton>
    </form>
  )
}

export function PasswordForm() {
  const [state, formAction] = useActionState(changePasswordAction, emptyActionState)

  return (
    <form action={formAction} className="space-y-4">
      {state.message ? (
        <Alert tone={state.ok ? 'success' : 'danger'}>{state.message}</Alert>
      ) : null}

      <Field
        label="Mot de passe actuel"
        htmlFor="currentPassword"
        error={state.fieldErrors?.currentPassword}
        required
      >
        <Input
          id="currentPassword"
          name="currentPassword"
          type="password"
          autoComplete="current-password"
          required
        />
      </Field>

      <Field
        label="Nouveau mot de passe"
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
          required
        />
      </Field>

      <Field
        label="Confirmer"
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

      <p className="text-[12.5px] text-[var(--text-3)]">
        Toutes vos sessions seront fermees : vous devrez vous reconnecter.
      </p>

      <div className="flex justify-end">
        <SubmitButton variant="secondary" pendingLabel="Mise à jour...">
          Changer le mot de passe
        </SubmitButton>
      </div>
    </form>
  )
}
