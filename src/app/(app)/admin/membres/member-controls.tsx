'use client'

import { useActionState, useEffect, useState } from 'react'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { Checkbox, Field, Input, Select } from '@/components/ui/field'
import { SubmitButton } from '@/components/ui/submit-button'
import { Alert } from '@/components/ui/feedback'
import { ConfirmForm } from '@/components/ui/confirm-form'
import { IconPlus } from '@/components/ui/icons'
import { emptyActionState } from '@/lib/errors'
import {
  changeMemberRoleAction,
  createInvitationAction,
  removeMemberAction,
  updateMemberStudentIdAction,
} from '@/app/actions/classes'

/** Ferme la modale une fois l'action reussie, apres le rendu. */
function useCloseOnSuccess(ok: boolean, onDone: () => void) {
  useEffect(() => {
    if (ok) onDone()
  }, [ok, onDone])
}

/** Bouton de creation d'un lien d'invitation. */
export function NewInvitationButton() {
  return (
    <Modal
      trigger={
        <>
          <IconPlus className="size-4" />
          Lien d invitation
        </>
      }
      triggerSize="sm"
      title="Nouveau lien d invitation"
      description="Partagez-le par message : il rejoint directement votre classe."
    >
      {(close) => <InvitationForm onDone={close} />}
    </Modal>
  )
}

function InvitationForm({ onDone }: { onDone: () => void }) {
  const [state, formAction] = useActionState(createInvitationAction, emptyActionState)
  useCloseOnSuccess(state.ok, onDone)

  return (
    <form action={formAction} className="space-y-4">
      {state.message ? (
        <Alert tone={state.ok ? 'success' : 'danger'}>{state.message}</Alert>
      ) : null}

      <Field label="Intitule" htmlFor="label" hint="Pour vous y retrouver (facultatif)">
        <Input id="label" name="label" placeholder="Groupe TD 2" maxLength={80} />
      </Field>

      <div className="grid sm:grid-cols-2 gap-3">
        <Field label="Role attribue" htmlFor="role" required>
          <Select id="role" name="role" defaultValue="MEMBER">
            <option value="MEMBER">Etudiant</option>
            <option value="ADMIN">Delegue (administrateur)</option>
          </Select>
        </Field>
        <Field label="Validite (jours)" htmlFor="days" required>
          <Input id="days" name="days" type="number" min={1} max={365} defaultValue={14} />
        </Field>
      </div>

      <Field
        label="Nombre maximal d utilisations"
        htmlFor="maxUses"
        hint="0 = illimite pendant la duree de validite"
      >
        <Input id="maxUses" name="maxUses" type="number" min={0} max={500} defaultValue={0} />
      </Field>

      <div className="flex justify-end">
        <SubmitButton pendingLabel="Creation...">Creer le lien</SubmitButton>
      </div>
    </form>
  )
}

/** Copie un lien d'invitation dans le presse-papiers. */
export function CopyButton({ value, label = 'Copier' }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false)

  return (
    <Button
      type="button"
      size="sm"
      variant="secondary"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value)
          setCopied(true)
          window.setTimeout(() => setCopied(false), 2000)
        } catch {
          // Presse-papiers refuse (contexte non securise) : l'utilisateur
          // peut toujours selectionner le texte affiche.
        }
      }}
    >
      {copied ? 'Copie' : label}
    </Button>
  )
}

/** Changement de role : ADMIN (delegue) ou MEMBER (etudiant). */
export function RoleSelect({
  membershipId,
  role,
  disabled,
}: {
  membershipId: string
  role: 'ADMIN' | 'MEMBER'
  disabled?: boolean
}) {
  return (
    <form action={changeMemberRoleAction}>
      <input type="hidden" name="membershipId" value={membershipId} />
      <label className="sr-only" htmlFor={`role-${membershipId}`}>
        Role du membre
      </label>
      <Select
        id={`role-${membershipId}`}
        name="role"
        defaultValue={role}
        disabled={disabled}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        className="h-8 text-[12.5px] w-[130px]"
      >
        <option value="MEMBER">Etudiant</option>
        <option value="ADMIN">Delegue</option>
      </Select>
    </form>
  )
}

export function RemoveMemberButton({
  membershipId,
  name,
}: {
  membershipId: string
  name: string
}) {
  return (
    <ConfirmForm
      action={removeMemberAction}
      hidden={{ membershipId }}
      message={`Retirer ${name} de la classe ? Son compte est conserve, mais il perd l acces aux donnees de la classe.`}
    >
      <Button type="submit" size="sm" variant="ghost">
        Retirer
      </Button>
    </ConfirmForm>
  )
}

export function EditStudentIdButton({
  membershipId,
  name,
  studentId,
}: {
  membershipId: string
  name: string
  studentId: string | null
}) {
  return (
    <Modal
      trigger="Numero"
      triggerVariant="ghost"
      triggerSize="sm"
      title={`Numero etudiant — ${name}`}
    >
      {(close) => (
        <StudentIdForm
          membershipId={membershipId}
          studentId={studentId}
          onDone={close}
        />
      )}
    </Modal>
  )
}

function StudentIdForm({
  membershipId,
  studentId,
  onDone,
}: {
  membershipId: string
  studentId: string | null
  onDone: () => void
}) {
  const [state, formAction] = useActionState(
    updateMemberStudentIdAction,
    emptyActionState,
  )
  useCloseOnSuccess(state.ok, onDone)

  return (
    <form action={formAction} className="space-y-4">
      {state.message ? (
        <Alert tone={state.ok ? 'success' : 'danger'}>{state.message}</Alert>
      ) : null}
      <input type="hidden" name="membershipId" value={membershipId} />
      <Field
        label="Numero etudiant"
        htmlFor="studentId"
        error={state.fieldErrors?.studentId}
        hint="Unique au sein de la classe. Laissez vide pour l effacer."
      >
        <Input
          id="studentId"
          name="studentId"
          defaultValue={studentId ?? ''}
          maxLength={40}
        />
      </Field>
      <div className="flex justify-end">
        <SubmitButton pendingLabel="Enregistrement...">Enregistrer</SubmitButton>
      </div>
    </form>
  )
}

/** Affiche ou masque les membres retires de la classe. */
export function ShowInactiveToggle({ checked }: { checked: boolean }) {
  return (
    <form action="/admin/membres" className="flex items-center">
      <Checkbox
        name="inactifs"
        value="1"
        defaultChecked={checked}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        label="Afficher les membres retires"
      />
    </form>
  )
}
