'use client'

import { useActionState, useEffect } from 'react'
import { Modal } from '@/components/ui/modal'
import { ConfirmForm, IconSubmit } from '@/components/ui/confirm-form'
import { IconPencil, IconPlus, IconTrash } from '@/components/ui/icons'
import { Field, Input, Select, Textarea } from '@/components/ui/field'
import { SubmitButton } from '@/components/ui/submit-button'
import { Alert } from '@/components/ui/feedback'
import { emptyActionState } from '@/lib/errors'
import { DEADLINE_CATEGORY_LABELS } from '@/lib/constants'
import {
  createDeadlineAction,
  deleteDeadlineAction,
  updateDeadlineAction,
} from '@/app/actions/deadlines'
import type { ModuleOption } from '../programme/schedule-form'

export type DeadlineFormValues = {
  id: string
  title: string
  description: string | null
  category: string
  dueAt: Date
  reminderAt: Date | null
  moduleId: string | null
}

/** Convertit une date en valeur acceptee par <input type="datetime-local">. */
function toLocalInput(date: Date | null | undefined): string {
  if (!date) return ''
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16)
}

function DeadlineForm({
  modules,
  deadline,
  onDone,
}: {
  modules: ModuleOption[]
  deadline?: DeadlineFormValues
  onDone?: () => void
}) {
  const isEdit = Boolean(deadline)
  const [state, formAction] = useActionState(
    isEdit ? updateDeadlineAction : createDeadlineAction,
    emptyActionState,
  )

  useEffect(() => {
    if (state.ok && onDone) onDone()
  }, [state.ok, onDone])

  return (
    <form action={formAction} className="space-y-4">
      {deadline ? <input type="hidden" name="deadlineId" value={deadline.id} /> : null}
      {state.message ? (
        <Alert tone={state.ok ? 'success' : 'danger'}>{state.message}</Alert>
      ) : null}

      <Field label="Titre" htmlFor="title" error={state.fieldErrors?.title} required>
        <Input
          id="title"
          name="title"
          defaultValue={deadline?.title ?? ''}
          required
          placeholder="Rapport de TP n3"
        />
      </Field>

      <Field label="Description" htmlFor="description" error={state.fieldErrors?.description}>
        <Textarea
          id="description"
          name="description"
          rows={3}
          defaultValue={deadline?.description ?? ''}
          placeholder="Format PDF, 10 pages maximum, depot sur la plateforme."
        />
      </Field>

      <div className="grid sm:grid-cols-2 gap-3">
        <Field label="Catégorie" htmlFor="category" error={state.fieldErrors?.category} required>
          <Select
            id="category"
            name="category"
            defaultValue={deadline?.category ?? 'DEVOIR'}
            required
          >
            {Object.entries(DEADLINE_CATEGORY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Module" htmlFor="moduleId" error={state.fieldErrors?.moduleId}>
          <Select id="moduleId" name="moduleId" defaultValue={deadline?.moduleId ?? ''}>
            <option value="">Aucun module</option>
            {modules.map((m) => (
              <option key={m.id} value={m.id}>
                {m.code} — {m.name}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <Field label="Date limite" htmlFor="dueAt" error={state.fieldErrors?.dueAt} required>
          <Input
            id="dueAt"
            name="dueAt"
            type="datetime-local"
            defaultValue={toLocalInput(deadline?.dueAt)}
            required
          />
        </Field>

        <Field
          label="Rappel"
          htmlFor="reminderAt"
          hint="Facultatif : notifie la classe a cette date"
          error={state.fieldErrors?.reminderAt}
        >
          <Input
            id="reminderAt"
            name="reminderAt"
            type="datetime-local"
            defaultValue={toLocalInput(deadline?.reminderAt)}
          />
        </Field>
      </div>

      <div className="flex justify-end pt-1">
        <SubmitButton pendingLabel="Enregistrement...">
          {isEdit ? 'Enregistrer' : "Ajouter l’échéance"}
        </SubmitButton>
      </div>
    </form>
  )
}

export function AddDeadlineButton({
  modules,
  autoOpen,
}: {
  modules: ModuleOption[]
  autoOpen?: boolean
}) {
  return (
    <Modal
      defaultOpen={autoOpen}
      trigger={
        <>
          <IconPlus className="size-4" />
          Ajouter une echeance
        </>
      }
      triggerSize="sm"
      title="Nouvelle échéance"
      description="La classe recevra une notification."
      width="lg"
    >
      {(close) => <DeadlineForm modules={modules} onDone={close} />}
    </Modal>
  )
}

export function DeadlineActions({
  deadline,
  modules,
}: {
  deadline: DeadlineFormValues
  modules: ModuleOption[]
}) {
  return (
    <div className="flex items-center gap-0.5">
      <Modal
        trigger={<IconPencil className="size-[17px]" />}
        triggerVariant="ghost"
        triggerSize="icon"
        title="Modifier l echeance"
        width="lg"
      >
        {(close) => (
          <DeadlineForm modules={modules} deadline={deadline} onDone={close} />
        )}
      </Modal>

      <ConfirmForm
        action={deleteDeadlineAction}
        hidden={{ deadlineId: deadline.id }}
        message="Supprimer cette echeance ?"
      >
        <IconSubmit label="Supprimer l echeance" tone="danger">
          <IconTrash className="size-[17px]" />
        </IconSubmit>
      </ConfirmForm>
    </div>
  )
}
