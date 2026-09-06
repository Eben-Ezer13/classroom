'use client'

import { useActionState, useEffect } from 'react'
import {
  createScheduleEntryAction,
  updateScheduleEntryAction,
} from '@/app/actions/schedule'
import { emptyActionState } from '@/lib/errors'
import { Checkbox, Field, Input, Select, Textarea } from '@/components/ui/field'
import { SubmitButton } from '@/components/ui/submit-button'
import { Alert } from '@/components/ui/feedback'
import { SCHEDULE_TYPE_LABELS } from '@/lib/constants'
import { minutesToTime } from '@/lib/utils'

export type ModuleOption = { id: string; code: string; name: string }
export type SemesterOption = { id: string; label: string; academicYear: { label: string } }

export type ScheduleFormValues = {
  id: string
  semesterId: string
  moduleId: string | null
  type: string
  title: string | null
  date: Date
  startMinutes: number
  endMinutes: number
  room: string | null
  teacherName: string | null
  note: string | null
  isPublished: boolean
}

export function ScheduleForm({
  modules,
  semesters,
  defaultSemesterId,
  entry,
  onDone,
}: {
  modules: ModuleOption[]
  semesters: SemesterOption[]
  defaultSemesterId: string | null
  entry?: ScheduleFormValues
  onDone?: () => void
}) {
  const isEdit = Boolean(entry)
  const [state, formAction] = useActionState(
    isEdit ? updateScheduleEntryAction : createScheduleEntryAction,
    emptyActionState,
  )

  // Effet et non appel direct : fermer la modale pendant le rendu
  // declencherait une mise a jour d etat sur un composant en cours de rendu.
  useEffect(() => {
    if (state.ok && onDone) onDone()
  }, [state.ok, onDone])

  const dateValue = entry ? entry.date.toISOString().slice(0, 10) : ''

  return (
    <form action={formAction} className="space-y-4">
      {entry ? <input type="hidden" name="entryId" value={entry.id} /> : null}
      {state.message ? (
        <Alert tone={state.ok ? 'success' : 'danger'}>{state.message}</Alert>
      ) : null}

      <div className="grid sm:grid-cols-2 gap-3">
        <Field label="Semestre" htmlFor="semesterId" error={state.fieldErrors?.semesterId} required>
          <Select
            id="semesterId"
            name="semesterId"
            defaultValue={entry?.semesterId ?? defaultSemesterId ?? ''}
            required
          >
            <option value="" disabled>
              Choisir un semestre
            </option>
            {semesters.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label} — {s.academicYear.label}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Type de séance" htmlFor="type" error={state.fieldErrors?.type} required>
          <Select id="type" name="type" defaultValue={entry?.type ?? 'COURS'} required>
            {Object.entries(SCHEDULE_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <Field
        label="Module"
        htmlFor="moduleId"
        error={state.fieldErrors?.moduleId}
        hint="Facultatif : laissez vide pour une séance hors module"
      >
        <Select id="moduleId" name="moduleId" defaultValue={entry?.moduleId ?? ''}>
          <option value="">Aucun module</option>
          {modules.map((m) => (
            <option key={m.id} value={m.id}>
              {m.code} — {m.name}
            </option>
          ))}
        </Select>
      </Field>

      <Field
        label="Intitulé"
        htmlFor="title"
        error={state.fieldErrors?.title}
        hint="Utile si la séance n’est pas rattachée à un module"
      >
        <Input
          id="title"
          name="title"
          defaultValue={entry?.title ?? ''}
          placeholder="Réunion de rentrée"
        />
      </Field>

      <div className="grid grid-cols-3 gap-3">
        <Field label="Date" htmlFor="date" error={state.fieldErrors?.date} required>
          <Input id="date" name="date" type="date" defaultValue={dateValue} required />
        </Field>
        <Field label="Debut" htmlFor="startTime" error={state.fieldErrors?.startTime} required>
          <Input
            id="startTime"
            name="startTime"
            type="time"
            defaultValue={entry ? minutesToTime(entry.startMinutes) : ''}
            required
          />
        </Field>
        <Field label="Fin" htmlFor="endTime" error={state.fieldErrors?.endTime} required>
          <Input
            id="endTime"
            name="endTime"
            type="time"
            defaultValue={entry ? minutesToTime(entry.endMinutes) : ''}
            required
          />
        </Field>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <Field label="Salle" htmlFor="room" error={state.fieldErrors?.room}>
          <Input id="room" name="room" defaultValue={entry?.room ?? ''} placeholder="B204" />
        </Field>
        <Field label="Professeur" htmlFor="teacherName" error={state.fieldErrors?.teacherName}>
          <Input
            id="teacherName"
            name="teacherName"
            defaultValue={entry?.teacherName ?? ''}
            placeholder="Mme Bennani"
          />
        </Field>
      </div>

      <Field label="Remarque" htmlFor="note" error={state.fieldErrors?.note}>
        <Textarea
          id="note"
          name="note"
          defaultValue={entry?.note ?? ''}
          rows={3}
          placeholder="Apporter le polycopie du chapitre 4."
        />
      </Field>

      <Checkbox
        name="isPublished"
        defaultChecked={entry?.isPublished ?? true}
        label="Publier immediatement (visible par les etudiants)"
      />

      <div className="flex justify-end gap-2 pt-1">
        <SubmitButton pendingLabel="Enregistrement...">
          {isEdit ? 'Enregistrer' : 'Ajouter la séance'}
        </SubmitButton>
      </div>
    </form>
  )
}
