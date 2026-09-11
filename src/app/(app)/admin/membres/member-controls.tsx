'use client'

import { useEffect, useState } from 'react'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { Checkbox, Field, Input, Select } from '@/components/ui/field'
import { SubmitButton } from '@/components/ui/submit-button'
import { Alert } from '@/components/ui/feedback'
import { ActionForm, ConfirmForm } from '@/components/ui/confirm-form'
import { IconPlus } from '@/components/ui/icons'
import { useFormAction } from '@/components/ui/use-form-action'
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
          Lien d’invitation
        </>
      }
      triggerSize="sm"
      title="Nouveau lien d’invitation"
      description="Partagez-le par message : il rejoint directement votre classe."
    >
      {(close) => <InvitationForm onDone={close} />}
    </Modal>
  )
}

function InvitationForm({ onDone }: { onDone: () => void }) {
  const { state, formAction, value } = useFormAction(createInvitationAction)
  useCloseOnSuccess(state.ok, onDone)

  return (
    <form action={formAction} className="space-y-4">
      {state.message ? (
        <Alert tone={state.ok ? 'success' : 'danger'}>{state.message}</Alert>
      ) : null}

      <Field label="Intitulé" htmlFor="label" hint="Pour vous y retrouver (facultatif)">
        <Input
          id="label"
          name="label"
          placeholder="Groupe TD 2"
          maxLength={80}
          defaultValue={value('label')}
        />
      </Field>

      <div className="grid sm:grid-cols-2 gap-3">
        <Field label="Rôle attribué" htmlFor="role" required>
          <Select id="role" name="role" defaultValue={value('role', 'MEMBER')}>
            <option value="MEMBER">Étudiant</option>
            <option value="ADMIN">Délégué (administrateur)</option>
          </Select>
        </Field>
        <Field label="Validité (jours)" htmlFor="days" required>
          <Input
            id="days"
            name="days"
            type="number"
            min={1}
            max={365}
            defaultValue={value('days', 14)}
          />
        </Field>
      </div>

      <Field
        label="Nombre maximal d’utilisations"
        htmlFor="maxUses"
        hint="0 = illimité pendant la durée de validité"
      >
        <Input
          id="maxUses"
          name="maxUses"
          type="number"
          min={0}
          max={500}
          defaultValue={value('maxUses', 0)}
        />
      </Field>

      <div className="flex justify-end">
        <SubmitButton pendingLabel="Création...">Créer le lien</SubmitButton>
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
      {copied ? 'Copié' : label}
    </Button>
  )
}

/** Changement de rôle : ADMIN (délégué) ou MEMBER (étudiant). */
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
    // Apres l'action, React reinitialise le formulaire : si le serveur refuse
    // le changement, le selecteur revient au role reel (message affiche).
    <ActionForm action={changeMemberRoleAction} hidden={{ membershipId }}>
      <label className="sr-only" htmlFor={`role-${membershipId}`}>
        Rôle du membre
      </label>
      <Select
        id={`role-${membershipId}`}
        name="role"
        defaultValue={role}
        disabled={disabled}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        className="h-8 text-[12.5px] w-[130px]"
      >
        <option value="MEMBER">Étudiant</option>
        <option value="ADMIN">Délégué</option>
      </Select>
    </ActionForm>
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
      message={`Retirer ${name} de la classe ? Son compte est conservé, mais il perd l’accès aux données de la classe.`}
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
      trigger="Numéro"
      triggerVariant="ghost"
      triggerSize="sm"
      title={`Numéro étudiant — ${name}`}
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
  const { state, formAction, value } = useFormAction(updateMemberStudentIdAction)
  useCloseOnSuccess(state.ok, onDone)

  return (
    <form action={formAction} className="space-y-4">
      {state.message ? (
        <Alert tone={state.ok ? 'success' : 'danger'}>{state.message}</Alert>
      ) : null}
      <input type="hidden" name="membershipId" value={membershipId} />
      <Field
        label="Numéro étudiant"
        htmlFor="studentId"
        error={state.fieldErrors?.studentId}
        hint="Unique au sein de la classe. Laissez vide pour l’effacer."
      >
        <Input
          id="studentId"
          name="studentId"
          defaultValue={value('studentId', studentId)}
          maxLength={40}
        />
      </Field>
      <div className="flex justify-end">
        <SubmitButton pendingLabel="Enregistrement...">Enregistrer</SubmitButton>
      </div>
    </form>
  )
}

/**
 * Affiche ou masque les membres retires de la classe.
 * Simple champ du formulaire de filtre qui l'entoure (un formulaire ne peut
 * pas en contenir un autre) : la recherche en cours est conservee.
 */
export function ShowInactiveToggle({ checked }: { checked: boolean }) {
  return (
    <Checkbox
      name="inactifs"
      value="1"
      defaultChecked={checked}
      onChange={(e) => e.currentTarget.form?.requestSubmit()}
      label="Afficher les membres retirés"
    />
  )
}
