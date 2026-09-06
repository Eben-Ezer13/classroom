'use client'

import { useActionState, useEffect, useState } from 'react'
import { Modal } from '@/components/ui/modal'
import { ConfirmForm, IconSubmit } from '@/components/ui/confirm-form'
import { IconClose, IconPencil, IconPlus, IconTrash } from '@/components/ui/icons'
import { Button } from '@/components/ui/button'
import { Checkbox, Field, Input, Textarea } from '@/components/ui/field'
import { SubmitButton } from '@/components/ui/submit-button'
import { Alert } from '@/components/ui/feedback'
import { emptyActionState } from '@/lib/errors'
import {
  closePollAction,
  createPollAction,
  deletePollAction,
  voteAction,
} from '@/app/actions/polls'

function PollForm({ onDone }: { onDone?: () => void }) {
  const [state, formAction] = useActionState(createPollAction, emptyActionState)
  const [options, setOptions] = useState(['', ''])

  useEffect(() => {
    if (state.ok && onDone) onDone()
  }, [state.ok, onDone])

  const setOption = (index: number, value: string) =>
    setOptions((prev) => prev.map((o, i) => (i === index ? value : o)))

  return (
    <form action={formAction} className="space-y-4">
      {state.message ? (
        <Alert tone={state.ok ? 'success' : 'danger'}>{state.message}</Alert>
      ) : null}

      <Field label="Question" htmlFor="title" error={state.fieldErrors?.title} required>
        <Input
          id="title"
          name="title"
          required
          placeholder="Quelle date preferez-vous pour le rattrapage ?"
        />
      </Field>

      <Field label="Precisions" htmlFor="description" error={state.fieldErrors?.description}>
        <Textarea
          id="description"
          name="description"
          rows={2}
          placeholder="Le rattrapage durera 2 heures, en salle B12."
        />
      </Field>

      <div>
        <p className="mb-1.5 text-[13px] font-medium text-[var(--text-2)]">
          Options <span className="text-[var(--danger)]">*</span>
        </p>
        <div className="space-y-2">
          {options.map((value, index) => (
            <div key={index} className="flex items-center gap-2">
              <Input
                name="options"
                value={value}
                onChange={(e) => setOption(index, e.target.value)}
                placeholder={`Option ${index + 1}`}
                required
              />
              {options.length > 2 ? (
                <button
                  type="button"
                  onClick={() => setOptions((prev) => prev.filter((_, i) => i !== index))}
                  aria-label={`Retirer l option ${index + 1}`}
                  className="shrink-0 size-9 grid place-items-center rounded-lg text-[var(--text-3)] hover:bg-[var(--danger-soft)] hover:text-[var(--danger)] transition-colors"
                >
                  <IconClose className="size-4" />
                </button>
              ) : null}
            </div>
          ))}
        </div>
        {state.fieldErrors?.options ? (
          <p className="mt-1.5 text-[12.5px] text-[var(--danger)]">
            {state.fieldErrors.options[0]}
          </p>
        ) : null}
        {options.length < 12 ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="mt-2"
            onClick={() => setOptions((prev) => [...prev, ''])}
          >
            <IconPlus className="size-3.5" />
            Ajouter une option
          </Button>
        ) : null}
      </div>

      <Field
        label="Date de cloture"
        htmlFor="endsAt"
        error={state.fieldErrors?.endsAt}
        required
      >
        <Input id="endsAt" name="endsAt" type="datetime-local" required />
      </Field>

      <div className="space-y-2">
        <Checkbox name="allowMultiple" label="Autoriser plusieurs reponses par etudiant" />
        <Checkbox name="isAnonymous" label="Masquer le detail des votants" />
      </div>

      <div className="flex justify-end pt-1">
        <SubmitButton pendingLabel="Creation...">Creer le sondage</SubmitButton>
      </div>
    </form>
  )
}

export function AddPollButton({ autoOpen }: { autoOpen?: boolean }) {
  return (
    <Modal
      defaultOpen={autoOpen}
      trigger={
        <>
          <IconPlus className="size-4" />
          Creer un sondage
        </>
      }
      triggerSize="sm"
      title="Nouveau sondage"
      description="La classe sera notifiee et pourra repondre jusqu a la cloture."
      width="lg"
    >
      {(close) => <PollForm onDone={close} />}
    </Modal>
  )
}

export function VoteForm({
  pollId,
  options,
  allowMultiple,
}: {
  pollId: string
  options: Array<{ id: string; label: string }>
  allowMultiple: boolean
}) {
  const [state, formAction] = useActionState(voteAction, emptyActionState)

  return (
    <form action={formAction} className="space-y-2.5">
      <input type="hidden" name="pollId" value={pollId} />
      {state.message ? (
        <Alert tone={state.ok ? 'success' : 'danger'}>{state.message}</Alert>
      ) : null}

      <div className="space-y-2">
        {options.map((option) => (
          <label
            key={option.id}
            className="flex items-center gap-3 rounded-lg border border-[var(--border)] px-3.5 py-2.5 cursor-pointer hover:bg-[var(--surface-2)] transition-colors has-[:checked]:border-[var(--accent)] has-[:checked]:bg-[var(--accent-soft)]"
          >
            <input
              type={allowMultiple ? 'checkbox' : 'radio'}
              name="optionIds"
              value={option.id}
              required={!allowMultiple}
              className="size-4 accent-[var(--accent)] cursor-pointer"
            />
            <span className="text-[13.5px] text-[var(--text-1)]">{option.label}</span>
          </label>
        ))}
      </div>

      <SubmitButton size="sm" pendingLabel="Envoi...">
        Valider mon vote
      </SubmitButton>
    </form>
  )
}

export function PollActions({ pollId, isClosed }: { pollId: string; isClosed: boolean }) {
  return (
    <div className="flex items-center gap-0.5">
      <ConfirmForm
        action={closePollAction}
        hidden={{ pollId }}
        message={isClosed ? 'Rouvrir ce sondage ?' : 'Clore ce sondage maintenant ?'}
      >
        <IconSubmit label={isClosed ? 'Rouvrir le sondage' : 'Clore le sondage'}>
          <IconPencil className="size-[17px]" />
        </IconSubmit>
      </ConfirmForm>

      <ConfirmForm
        action={deletePollAction}
        hidden={{ pollId }}
        message="Supprimer ce sondage et tous ses votes ?"
      >
        <IconSubmit label="Supprimer le sondage" tone="danger">
          <IconTrash className="size-[17px]" />
        </IconSubmit>
      </ConfirmForm>
    </div>
  )
}
