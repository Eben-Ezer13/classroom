'use client'

import { useActionState, useEffect } from 'react'
import { Modal } from '@/components/ui/modal'
import { IconPlus } from '@/components/ui/icons'
import { Field, Input, Select, Textarea } from '@/components/ui/field'
import { SubmitButton } from '@/components/ui/submit-button'
import { Alert } from '@/components/ui/feedback'
import { emptyActionState } from '@/lib/errors'
import {
  ALLOWED_EXTENSIONS,
  COMPLAINT_CATEGORY_LABELS,
  COMPLAINT_PRIORITY_LABELS,
  COMPLAINT_STATUS_LABELS,
  MAX_FILE_SIZE,
} from '@/lib/constants'
import {
  addComplaintMessageAction,
  createComplaintAction,
  updateComplaintStatusAction,
} from '@/app/actions/complaints'

function ComplaintForm({ onDone }: { onDone?: () => void }) {
  const [state, formAction] = useActionState(createComplaintAction, emptyActionState)

  useEffect(() => {
    if (state.ok && onDone) onDone()
  }, [state.ok, onDone])

  return (
    <form action={formAction} className="space-y-4">
      {state.message ? (
        <Alert tone={state.ok ? 'success' : 'danger'}>{state.message}</Alert>
      ) : null}

      <Field label="Titre" htmlFor="title" error={state.fieldErrors?.title} required>
        <Input
          id="title"
          name="title"
          required
          placeholder="Salle de TP indisponible le mardi"
        />
      </Field>

      <div className="grid sm:grid-cols-2 gap-3">
        <Field label="Catégorie" htmlFor="category" error={state.fieldErrors?.category} required>
          <Select id="category" name="category" defaultValue="AUTRE" required>
            {Object.entries(COMPLAINT_CATEGORY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Priorité" htmlFor="priority" error={state.fieldErrors?.priority} required>
          <Select id="priority" name="priority" defaultValue="NORMALE" required>
            {Object.entries(COMPLAINT_PRIORITY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <Field
        label="Description"
        htmlFor="description"
        error={state.fieldErrors?.description}
        hint="Décrivez précisément la difficulté rencontrée."
        required
      >
        <Textarea id="description" name="description" rows={5} required />
      </Field>

      <Field
        label="Pièces jointes"
        htmlFor="attachments"
        hint={`Facultatif · ${MAX_FILE_SIZE / 1024 / 1024} Mo maximum par fichier`}
      >
        <input
          id="attachments"
          name="attachments"
          type="file"
          multiple
          accept={ALLOWED_EXTENSIONS.join(',')}
          className="w-full text-[13px] text-[var(--text-2)] file:mr-3 file:rounded-lg file:border-0 file:bg-[var(--accent-soft)] file:px-3 file:py-2 file:text-[13px] file:font-medium file:text-[var(--accent-strong)] hover:file:brightness-95 cursor-pointer"
        />
      </Field>

      <div className="flex justify-end pt-1">
        <SubmitButton pendingLabel="Envoi...">Envoyer la reclamation</SubmitButton>
      </div>
    </form>
  )
}

export function AddComplaintButton({ autoOpen }: { autoOpen?: boolean }) {
  return (
    <Modal
      defaultOpen={autoOpen}
      trigger={
        <>
          <IconPlus className="size-4" />
          Signaler une difficulte
        </>
      }
      triggerSize="sm"
      title="Signaler une difficulte"
      description="Seuls vous et les responsables de votre classe verrez cette reclamation."
      width="lg"
    >
      {(close) => <ComplaintForm onDone={close} />}
    </Modal>
  )
}

export function ComplaintMessageForm({ complaintId }: { complaintId: string }) {
  const [state, formAction] = useActionState(addComplaintMessageAction, emptyActionState)

  return (
    <form action={formAction} className="space-y-3" key={state.ok ? 'sent' : 'draft'}>
      <input type="hidden" name="complaintId" value={complaintId} />
      {state.message && !state.ok ? <Alert tone="danger">{state.message}</Alert> : null}

      <Field label="Votre message" htmlFor="body" error={state.fieldErrors?.body}>
        <Textarea
          id="body"
          name="body"
          rows={3}
          required
          placeholder="Ajouter une precision ou une reponse..."
        />
      </Field>

      <div className="flex justify-end">
        <SubmitButton size="sm" pendingLabel="Envoi...">
          Envoyer
        </SubmitButton>
      </div>
    </form>
  )
}

export function ComplaintStatusForm({
  complaintId,
  status,
}: {
  complaintId: string
  status: string
}) {
  const [state, formAction] = useActionState(updateComplaintStatusAction, emptyActionState)

  return (
    <form action={formAction} className="space-y-2.5">
      <input type="hidden" name="complaintId" value={complaintId} />
      {state.message ? (
        <Alert tone={state.ok ? 'success' : 'danger'}>{state.message}</Alert>
      ) : null}

      <Field label="Statut" htmlFor="status">
        <Select id="status" name="status" defaultValue={status}>
          {Object.entries(COMPLAINT_STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
      </Field>

      <SubmitButton size="sm" variant="secondary" className="w-full" pendingLabel="...">
        Mettre a jour le statut
      </SubmitButton>
    </form>
  )
}
