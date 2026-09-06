'use client'

import { useActionState, useEffect } from 'react'
import { Modal } from '@/components/ui/modal'
import { ConfirmForm, IconSubmit } from '@/components/ui/confirm-form'
import { IconPencil, IconPlus, IconTrash } from '@/components/ui/icons'
import { Checkbox, Field, Input, Select, Textarea } from '@/components/ui/field'
import { SubmitButton } from '@/components/ui/submit-button'
import { Alert } from '@/components/ui/feedback'
import { emptyActionState } from '@/lib/errors'
import {
  ANNOUNCEMENT_CATEGORY_LABELS,
  ANNOUNCEMENT_LEVEL_LABELS,
} from '@/lib/constants'
import {
  createAnnouncementAction,
  deleteAnnouncementAction,
  updateAnnouncementAction,
} from '@/app/actions/announcements'
import type { ModuleOption } from '../programme/schedule-form'

export type AnnouncementFormValues = {
  id: string
  title: string
  content: string
  level: string
  category: string
  isPinned: boolean
  moduleId: string | null
  expiresAt: Date | null
}

function AnnouncementForm({
  modules,
  announcement,
  onDone,
}: {
  modules: ModuleOption[]
  announcement?: AnnouncementFormValues
  onDone?: () => void
}) {
  const isEdit = Boolean(announcement)
  const [state, formAction] = useActionState(
    isEdit ? updateAnnouncementAction : createAnnouncementAction,
    emptyActionState,
  )

  useEffect(() => {
    if (state.ok && onDone) onDone()
  }, [state.ok, onDone])

  return (
    <form action={formAction} className="space-y-4">
      {announcement ? (
        <input type="hidden" name="announcementId" value={announcement.id} />
      ) : null}
      {state.message ? (
        <Alert tone={state.ok ? 'success' : 'danger'}>{state.message}</Alert>
      ) : null}

      <Field label="Titre" htmlFor="title" error={state.fieldErrors?.title} required>
        <Input
          id="title"
          name="title"
          defaultValue={announcement?.title ?? ''}
          required
          placeholder="Changement de salle pour le TP de jeudi"
        />
      </Field>

      <Field label="Contenu" htmlFor="content" error={state.fieldErrors?.content} required>
        <Textarea
          id="content"
          name="content"
          rows={5}
          defaultValue={announcement?.content ?? ''}
          required
          placeholder="Le TP d automatique de jeudi 14h se tiendra en salle B12 au lieu de A03."
        />
      </Field>

      <div className="grid sm:grid-cols-2 gap-3">
        <Field label="Niveau" htmlFor="level" error={state.fieldErrors?.level} required>
          <Select id="level" name="level" defaultValue={announcement?.level ?? 'NORMAL'} required>
            {Object.entries(ANNOUNCEMENT_LEVEL_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Catégorie" htmlFor="category" error={state.fieldErrors?.category} required>
          <Select
            id="category"
            name="category"
            defaultValue={announcement?.category ?? 'GENERALE'}
            required
          >
            {Object.entries(ANNOUNCEMENT_CATEGORY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <Field label="Module concerne" htmlFor="moduleId" error={state.fieldErrors?.moduleId}>
          <Select id="moduleId" name="moduleId" defaultValue={announcement?.moduleId ?? ''}>
            <option value="">Aucun module</option>
            {modules.map((m) => (
              <option key={m.id} value={m.id}>
                {m.code} — {m.name}
              </option>
            ))}
          </Select>
        </Field>

        <Field
          label="Expire le"
          htmlFor="expiresAt"
          hint="Facultatif : l’annonce disparaît après cette date"
          error={state.fieldErrors?.expiresAt}
        >
          <Input
            id="expiresAt"
            name="expiresAt"
            type="datetime-local"
            defaultValue={
              announcement?.expiresAt
                ? new Date(
                    announcement.expiresAt.getTime() -
                      announcement.expiresAt.getTimezoneOffset() * 60000,
                  )
                    .toISOString()
                    .slice(0, 16)
                : ''
            }
          />
        </Field>
      </div>

      <Checkbox
        name="isPinned"
        defaultChecked={announcement?.isPinned ?? false}
        label="Epingler en haut de la liste"
      />

      <div className="flex justify-end pt-1">
        <SubmitButton pendingLabel="Publication...">
          {isEdit ? 'Enregistrer' : "Publier l'annonce"}
        </SubmitButton>
      </div>
    </form>
  )
}

export function AddAnnouncementButton({
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
          Publier une annonce
        </>
      }
      triggerSize="sm"
      title="Nouvelle annonce"
      description="Toute la classe recevra une notification."
      width="lg"
    >
      {(close) => <AnnouncementForm modules={modules} onDone={close} />}
    </Modal>
  )
}

export function AnnouncementActions({
  announcement,
  modules,
}: {
  announcement: AnnouncementFormValues
  modules: ModuleOption[]
}) {
  return (
    <>
      <Modal
        trigger={<IconPencil className="size-[17px]" />}
        triggerVariant="ghost"
        triggerSize="icon"
        title="Modifier l annonce"
        width="lg"
      >
        {(close) => (
          <AnnouncementForm modules={modules} announcement={announcement} onDone={close} />
        )}
      </Modal>

      <ConfirmForm
        action={deleteAnnouncementAction}
        hidden={{ announcementId: announcement.id }}
        message="Supprimer cette annonce ?"
      >
        <IconSubmit label="Supprimer l annonce" tone="danger">
          <IconTrash className="size-[17px]" />
        </IconSubmit>
      </ConfirmForm>
    </>
  )
}
