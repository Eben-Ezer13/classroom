'use client'

import { useActionState, useEffect } from 'react'
import { useFormAction } from '@/components/ui/use-form-action'
import { Modal } from '@/components/ui/modal'
import { IconPlus } from '@/components/ui/icons'
import { Field, Input, Select, Textarea } from '@/components/ui/field'
import { SubmitButton } from '@/components/ui/submit-button'
import { Alert } from '@/components/ui/feedback'
import { uploadPendingLabel, useDirectUploads } from '@/components/features/direct-upload'
import { emptyActionState, type ActionState } from '@/lib/errors'
import {
  ALLOWED_EXTENSIONS,
  COMPLAINT_ATTACHMENT_MAX_SIZE,
  COMPLAINT_CATEGORY_LABELS,
  COMPLAINT_MAX_ATTACHMENTS,
  COMPLAINT_PRIORITY_LABELS,
  COMPLAINT_STATUS_LABELS,
} from '@/lib/constants'
import { formatFileSize } from '@/lib/utils'
import {
  addComplaintMessageAction,
  createComplaintAction,
  updateComplaintStatusAction,
} from '@/app/actions/complaints'

function ComplaintForm({ onDone }: { onDone?: () => void }) {
  const { prepare, progress } = useDirectUploads()
  const { state, formAction, value } = useFormAction(
    async (previous: ActionState, formData: FormData): Promise<ActionState> => {
      const problem = await prepare(formData, { field: 'attachments', kind: 'complaint' })
      if (problem) return { ok: false, message: problem }
      return createComplaintAction(previous, formData)
    },
  )

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
          maxLength={160}
          defaultValue={value('title')}
          placeholder="Salle de TP indisponible le mardi"
        />
      </Field>

      <div className="grid sm:grid-cols-2 gap-3">
        <Field label="Catégorie" htmlFor="category" error={state.fieldErrors?.category} required>
          <Select id="category" name="category" defaultValue={value('category', 'AUTRE')} required>
            {Object.entries(COMPLAINT_CATEGORY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Priorité" htmlFor="priority" error={state.fieldErrors?.priority} required>
          <Select id="priority" name="priority" defaultValue={value('priority', 'NORMALE')} required>
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
        <Textarea
          id="description"
          name="description"
          rows={5}
          maxLength={5000}
          defaultValue={value('description')}
          required
        />
      </Field>

      <Field
        label="Pièces jointes"
        htmlFor="attachments"
        hint={`Facultatif · ${COMPLAINT_MAX_ATTACHMENTS} fichiers au plus, ${formatFileSize(COMPLAINT_ATTACHMENT_MAX_SIZE)} maximum chacun`}
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
        <SubmitButton pendingLabel={uploadPendingLabel(progress, 'Envoi...')}>
          Envoyer la réclamation
        </SubmitButton>
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
          Signaler une difficulté
        </>
      }
      triggerSize="sm"
      title="Signaler une difficulté"
      description="Seuls vous et les responsables de votre classe verrez cette réclamation."
      width="lg"
    >
      {(close) => <ComplaintForm onDone={close} />}
    </Modal>
  )
}

export function ComplaintMessageForm({ complaintId }: { complaintId: string }) {
  const { state, formAction, value } = useFormAction(addComplaintMessageAction)

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
          maxLength={3000}
          defaultValue={value('body')}
          placeholder="Ajouter une précision ou une réponse..."
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
        Mettre à jour le statut
      </SubmitButton>
    </form>
  )
}
