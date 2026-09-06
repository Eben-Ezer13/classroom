'use client'

import { useActionState, useEffect } from 'react'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { Field, Input, Select, Textarea } from '@/components/ui/field'
import { SubmitButton } from '@/components/ui/submit-button'
import { Alert } from '@/components/ui/feedback'
import { ConfirmForm, IconSubmit } from '@/components/ui/confirm-form'
import { IconTrash, IconUpload } from '@/components/ui/icons'
import { emptyActionState } from '@/lib/errors'
import {
  deleteScheduleDocumentAction,
  setCurrentScheduleDocumentAction,
  uploadScheduleDocumentAction,
} from '@/app/actions/schedule'
import { SCHEDULE_DOC_MAX_SIZE } from '@/lib/constants'
import { formatFileSize } from '@/lib/utils'
import type { SemesterOption } from './schedule-form'

/**
 * Depot du planning officiel recu par le delegue (photo ou PDF).
 * Complementaire de la saisie manuelle : les deux peuvent coexister.
 */
export function UploadScheduleDocumentButton({
  semesters,
  defaultSemesterId,
  hasDocument,
}: {
  semesters: SemesterOption[]
  defaultSemesterId: string | null
  hasDocument: boolean
}) {
  return (
    <Modal
      trigger={
        <>
          <IconUpload className="size-4" />
          {hasDocument ? 'Remplacer' : 'Televerser'}
        </>
      }
      triggerVariant="secondary"
      triggerSize="sm"
      title="Emploi du temps officiel"
      description={`Image (PNG, JPEG, WEBP) ou PDF, ${formatFileSize(SCHEDULE_DOC_MAX_SIZE)} maximum.`}
    >
      {(close) => (
        <DocumentForm
          semesters={semesters}
          defaultSemesterId={defaultSemesterId}
          onDone={close}
        />
      )}
    </Modal>
  )
}

function DocumentForm({
  semesters,
  defaultSemesterId,
  onDone,
}: {
  semesters: SemesterOption[]
  defaultSemesterId: string | null
  onDone: () => void
}) {
  const [state, formAction] = useActionState(
    uploadScheduleDocumentAction,
    emptyActionState,
  )

  useEffect(() => {
    if (state.ok) onDone()
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
          defaultValue=""
          placeholder="Intitulé du document"
          maxLength={140}
        />
      </Field>

      <Field label="Semestre" htmlFor="semesterId" error={state.fieldErrors?.semesterId}>
        <Select id="semesterId" name="semesterId" defaultValue={defaultSemesterId ?? ''}>
          <option value="">Non precise</option>
          {semesters.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label} — {s.academicYear.label}
            </option>
          ))}
        </Select>
      </Field>

      <Field
        label="Fichier"
        htmlFor="file"
        hint="Photo du planning affiche, export PDF de l administration..."
        required
      >
        <input
          id="file"
          name="file"
          type="file"
          required
          accept="image/png,image/jpeg,image/webp,application/pdf"
          className="block w-full text-[13px] text-[var(--text-2)] file:mr-3 file:rounded-lg file:border-0 file:bg-[var(--accent-soft)] file:px-3 file:py-2 file:text-[13px] file:font-medium file:text-[var(--accent-strong)]"
        />
      </Field>

      <Field label="Note" htmlFor="note" error={state.fieldErrors?.note} hint="Facultatif">
        <Textarea id="note" name="note" rows={2} maxLength={500} />
      </Field>

      <div className="flex justify-end">
        <SubmitButton pendingLabel="Envoi...">Televerser</SubmitButton>
      </div>
    </form>
  )
}

export function ScheduleDocumentActions({
  documentId,
  title,
  isCurrent,
}: {
  documentId: string
  title: string
  isCurrent: boolean
}) {
  return (
    <div className="flex items-center gap-1.5">
      {isCurrent ? null : (
        <form action={setCurrentScheduleDocumentAction}>
          <input type="hidden" name="documentId" value={documentId} />
          <Button type="submit" size="sm" variant="ghost">
            Mettre en avant
          </Button>
        </form>
      )}
      <ConfirmForm
        action={deleteScheduleDocumentAction}
        hidden={{ documentId }}
        message={`Supprimer "${title}" ? Le fichier sera efface du stockage.`}
      >
        <IconSubmit label="Supprimer le document" tone="danger">
          <IconTrash className="size-[17px]" />
        </IconSubmit>
      </ConfirmForm>
    </div>
  )
}
