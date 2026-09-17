'use client'

import { useMemo, useState } from 'react'
import { Modal } from '@/components/ui/modal'
import { ConfirmForm, IconSubmit } from '@/components/ui/confirm-form'
import { IconPencil, IconPlus, IconTrash } from '@/components/ui/icons'
import { Checkbox, Field, Input, Select, Textarea } from '@/components/ui/field'
import { SubmitButton } from '@/components/ui/submit-button'
import { Alert } from '@/components/ui/feedback'
import { useCloseOnSuccess, useFormAction } from '@/components/ui/use-form-action'
import { toDateTimeInputValue } from '@/lib/utils'
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
  mentionsAll: boolean
  mentionedUserIds: string[]
}

/** Membre mentionnable dans une annonce. */
export type MemberOption = { id: string; name: string }

/**
 * Selection des membres mentionnes. La selection est un etat React (et non
 * de simples cases a cocher) : filtrer la liste ne perd pas les membres deja
 * choisis, envoyes via des champs caches.
 */
function MentionPicker({
  members,
  initial,
}: {
  members: MemberOption[]
  initial: string[]
}) {
  const [selected, setSelected] = useState<Set<string>>(() => new Set(initial))
  const [query, setQuery] = useState('')

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return q ? members.filter((m) => m.name.toLowerCase().includes(q)) : members
  }, [members, query])

  const toggle = (id: string) =>
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  if (members.length === 0) {
    return (
      <p className="text-[12.5px] text-[var(--text-3)]">
        Aucun autre membre à mentionner pour le moment.
      </p>
    )
  }

  return (
    <div className="space-y-2">
      {[...selected].map((id) => (
        <input key={id} type="hidden" name="mentionedUserIds" value={id} />
      ))}
      <Input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Rechercher un membre..."
        aria-label="Rechercher un membre à mentionner"
        className="h-9"
      />
      <div className="max-h-40 overflow-y-auto rounded-lg border border-[var(--border)] divide-y divide-[var(--border)]">
        {visible.length === 0 ? (
          <p className="px-3 py-2 text-[12.5px] text-[var(--text-3)]">Aucun membre trouvé.</p>
        ) : (
          visible.map((member) => (
            <label
              key={member.id}
              className="flex items-center gap-2.5 px-3 py-2 text-[13px] text-[var(--text-2)] cursor-pointer hover:bg-[var(--surface-2)]"
            >
              <input
                type="checkbox"
                checked={selected.has(member.id)}
                onChange={() => toggle(member.id)}
                className="size-4 accent-[var(--accent)] cursor-pointer"
              />
              {member.name}
            </label>
          ))
        )}
      </div>
      {selected.size > 0 ? (
        <p className="text-[12px] text-[var(--text-3)]">
          {selected.size > 1
            ? `${selected.size} membres mentionnés : une notification dédiée leur sera envoyée.`
            : '1 membre mentionné : une notification dédiée lui sera envoyée.'}
        </p>
      ) : null}
    </div>
  )
}

function AnnouncementForm({
  modules,
  members,
  announcement,
  onDone,
}: {
  modules: ModuleOption[]
  members: MemberOption[]
  announcement?: AnnouncementFormValues
  onDone?: () => void
}) {
  const isEdit = Boolean(announcement)
  const { state, formAction, value, checked, list } = useFormAction(
    isEdit ? updateAnnouncementAction : createAnnouncementAction,
  )

  useCloseOnSuccess(state, onDone)

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
          defaultValue={value('title', announcement?.title)}
          required
          maxLength={160}
          placeholder="Changement de salle pour le TP de jeudi"
        />
      </Field>

      <Field label="Contenu" htmlFor="content" error={state.fieldErrors?.content} required>
        <Textarea
          id="content"
          name="content"
          rows={5}
          defaultValue={value('content', announcement?.content)}
          required
          maxLength={5000}
          placeholder="Le TP d’automatique de jeudi 14h se tiendra en salle B12 au lieu de A03."
        />
      </Field>

      <div className="grid sm:grid-cols-2 gap-3">
        <Field label="Niveau" htmlFor="level" error={state.fieldErrors?.level} required>
          <Select
            id="level"
            name="level"
            defaultValue={value('level', announcement?.level ?? 'NORMAL')}
            required
          >
            {Object.entries(ANNOUNCEMENT_LEVEL_LABELS).map(([level, label]) => (
              <option key={level} value={level}>
                {label}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Catégorie" htmlFor="category" error={state.fieldErrors?.category} required>
          <Select
            id="category"
            name="category"
            defaultValue={value('category', announcement?.category ?? 'GENERALE')}
            required
          >
            {Object.entries(ANNOUNCEMENT_CATEGORY_LABELS).map(([category, label]) => (
              <option key={category} value={category}>
                {label}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <Field label="Module concerné" htmlFor="moduleId" error={state.fieldErrors?.moduleId}>
          <Select id="moduleId" name="moduleId" defaultValue={value('moduleId', announcement?.moduleId)}>
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
            defaultValue={value('expiresAt', toDateTimeInputValue(announcement?.expiresAt))}
          />
        </Field>
      </div>

      <Checkbox
        name="isPinned"
        defaultChecked={checked('isPinned', announcement?.isPinned ?? false)}
        label="Épingler en haut de la liste"
      />

      <fieldset className="space-y-2">
        <legend className="text-[13px] font-medium text-[var(--text-2)] mb-1.5">
          Mentions
        </legend>
        <Checkbox
          name="mentionsAll"
          defaultChecked={checked('mentionsAll', announcement?.mentionsAll ?? false)}
          label="@tous : mentionner toute la classe"
        />
        <MentionPicker
          // La cle recree le selecteur apres un refus du serveur : il reprend
          // alors la selection soumise.
          key={state.values ? 'retry' : 'initial'}
          members={members}
          initial={list('mentionedUserIds', announcement?.mentionedUserIds ?? [])}
        />
      </fieldset>

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
  members,
  autoOpen,
}: {
  modules: ModuleOption[]
  members: MemberOption[]
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
      {(close) => <AnnouncementForm modules={modules} members={members} onDone={close} />}
    </Modal>
  )
}

export function AnnouncementActions({
  announcement,
  modules,
  members,
}: {
  announcement: AnnouncementFormValues
  modules: ModuleOption[]
  members: MemberOption[]
}) {
  return (
    <>
      <Modal
        trigger={<IconPencil className="size-[17px]" />}
        triggerVariant="ghost"
        triggerSize="icon"
        title="Modifier l’annonce"
        width="lg"
      >
        {(close) => (
          <AnnouncementForm
            modules={modules}
            members={members}
            announcement={announcement}
            onDone={close}
          />
        )}
      </Modal>

      <ConfirmForm
        action={deleteAnnouncementAction}
        hidden={{ announcementId: announcement.id }}
        message="Supprimer cette annonce ?"
      >
        <IconSubmit label="Supprimer l’annonce" tone="danger">
          <IconTrash className="size-[17px]" />
        </IconSubmit>
      </ConfirmForm>
    </>
  )
}
