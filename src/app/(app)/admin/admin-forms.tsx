'use client'

import { useActionState, useEffect } from 'react'
import { Modal } from '@/components/ui/modal'
import { IconPlus } from '@/components/ui/icons'
import { Checkbox, Field, Input, Select } from '@/components/ui/field'
import { SubmitButton } from '@/components/ui/submit-button'
import { Alert } from '@/components/ui/feedback'
import { emptyActionState } from '@/lib/errors'
import { createAcademicYearAction, createSemesterAction } from '@/app/actions/admin'

/**
 * Formulaires du calendrier academique de la classe.
 * Aucun champ ne designe la classe : le serveur travaille toujours sur la
 * classe active du delegue, donc rien a falsifier cote client.
 */

type Option = { id: string; label: string }

function useCloseOnSuccess(ok: boolean, onDone?: () => void) {
  useEffect(() => {
    if (ok && onDone) onDone()
  }, [ok, onDone])
}

/** Modale generique : bouton + titre + contenu de formulaire. */
function FormModal({
  label,
  title,
  description,
  children,
}: {
  label: string
  title: string
  description?: string
  children: (close: () => void) => React.ReactNode
}) {
  return (
    <Modal
      trigger={
        <>
          <IconPlus className="size-4" />
          {label}
        </>
      }
      triggerSize="sm"
      title={title}
      description={description}
    >
      {children}
    </Modal>
  )
}

export function AddYearButton() {
  return (
    <FormModal
      label="Annee"
      title="Nouvelle année académique"
      description="Les modules et ressources sont rattaches aux semestres de cette annee."
    >
      {(close) => <YearForm onDone={close} />}
    </FormModal>
  )
}

function YearForm({ onDone }: { onDone: () => void }) {
  const [state, formAction] = useActionState(createAcademicYearAction, emptyActionState)
  useCloseOnSuccess(state.ok, onDone)

  return (
    <form action={formAction} className="space-y-4">
      {state.message ? (
        <Alert tone={state.ok ? 'success' : 'danger'}>{state.message}</Alert>
      ) : null}
      <Field label="Libelle" htmlFor="label" error={state.fieldErrors?.label} required>
        <Input id="label" name="label" required placeholder="2026/2027" maxLength={20} />
      </Field>
      <div className="grid sm:grid-cols-2 gap-3">
        <Field label="Debut" htmlFor="startsAt" error={state.fieldErrors?.startsAt} required>
          <Input id="startsAt" name="startsAt" type="date" required />
        </Field>
        <Field label="Fin" htmlFor="endsAt" error={state.fieldErrors?.endsAt} required>
          <Input id="endsAt" name="endsAt" type="date" required />
        </Field>
      </div>
      <Checkbox name="isCurrent" label="Definir comme annee courante" defaultChecked />
      <div className="flex justify-end">
        <SubmitButton pendingLabel="Création...">Créer</SubmitButton>
      </div>
    </form>
  )
}

export function AddSemesterButton({ years }: { years: Option[] }) {
  return (
    <FormModal label="Semestre" title="Nouveau semestre">
      {(close) => <SemesterForm years={years} onDone={close} />}
    </FormModal>
  )
}

function SemesterForm({ years, onDone }: { years: Option[]; onDone: () => void }) {
  const [state, formAction] = useActionState(createSemesterAction, emptyActionState)
  useCloseOnSuccess(state.ok, onDone)

  return (
    <form action={formAction} className="space-y-4">
      {state.message ? (
        <Alert tone={state.ok ? 'success' : 'danger'}>{state.message}</Alert>
      ) : null}
      <Field
        label="Annee academique"
        htmlFor="academicYearId"
        error={state.fieldErrors?.academicYearId}
        required
      >
        <Select id="academicYearId" name="academicYearId" required defaultValue="">
          <option value="" disabled>
            Choisir
          </option>
          {years.map((y) => (
            <option key={y.id} value={y.id}>
              {y.label}
            </option>
          ))}
        </Select>
      </Field>
      <div className="grid grid-cols-[110px_1fr] gap-3">
        <Field label="Numero" htmlFor="number" error={state.fieldErrors?.number} required>
          <Input id="number" name="number" type="number" min={1} max={12} required />
        </Field>
        <Field label="Libelle" htmlFor="label" error={state.fieldErrors?.label} required>
          <Input id="label" name="label" required placeholder="Semestre 7" />
        </Field>
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        <Field label="Debut" htmlFor="startsAt" error={state.fieldErrors?.startsAt} required>
          <Input id="startsAt" name="startsAt" type="date" required />
        </Field>
        <Field label="Fin" htmlFor="endsAt" error={state.fieldErrors?.endsAt} required>
          <Input id="endsAt" name="endsAt" type="date" required />
        </Field>
      </div>
      <Checkbox name="isCurrent" label="Definir comme semestre courant" />
      <div className="flex justify-end">
        <SubmitButton pendingLabel="Création...">Créer</SubmitButton>
      </div>
    </form>
  )
}
