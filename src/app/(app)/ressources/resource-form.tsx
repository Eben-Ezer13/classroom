'use client'

import { useActionState, useEffect } from 'react'
import { createResourceAction, updateResourceAction } from '@/app/actions/resources'
import { emptyActionState } from '@/lib/errors'
import { Field, Input, Select, Textarea } from '@/components/ui/field'
import { SubmitButton } from '@/components/ui/submit-button'
import { Alert } from '@/components/ui/feedback'
import {
  ALLOWED_EXTENSIONS,
  MAX_FILE_SIZE,
  RESOURCE_KIND_LABELS,
} from '@/lib/constants'
import type { ModuleOption, SemesterOption } from '../programme/schedule-form'

export type ResourceFormValues = {
  id: string
  title: string
  description: string | null
  kind: string
  moduleId: string | null
}

export function ResourceForm({
  modules,
  semesters,
  defaultSemesterId,
  defaultModuleId,
  resource,
  onDone,
}: {
  modules: ModuleOption[]
  semesters: SemesterOption[]
  defaultSemesterId: string | null
  defaultModuleId?: string
  resource?: ResourceFormValues
  onDone?: () => void
}) {
  const isEdit = Boolean(resource)
  const [state, formAction] = useActionState(
    isEdit ? updateResourceAction : createResourceAction,
    emptyActionState,
  )

  useEffect(() => {
    if (state.ok && onDone) onDone()
  }, [state.ok, onDone])

  return (
    <form action={formAction} className="space-y-4">
      {resource ? <input type="hidden" name="id" value={resource.id} /> : null}
      {state.message ? (
        <Alert tone={state.ok ? 'success' : 'danger'}>{state.message}</Alert>
      ) : null}

      <Field label="Titre" htmlFor="title" error={state.fieldErrors?.title} required>
        <Input
          id="title"
          name="title"
          defaultValue={resource?.title ?? ''}
          required
          placeholder="Chapitre 3 — Asservissements"
        />
      </Field>

      <Field label="Description" htmlFor="description" error={state.fieldErrors?.description}>
        <Textarea
          id="description"
          name="description"
          rows={3}
          defaultValue={resource?.description ?? ''}
          placeholder="Support de cours complet, avec exercices corriges."
        />
      </Field>

      <div className="grid sm:grid-cols-2 gap-3">
        <Field label="Type" htmlFor="kind" error={state.fieldErrors?.kind} required>
          <Select id="kind" name="kind" defaultValue={resource?.kind ?? 'COURS'} required>
            {Object.entries(RESOURCE_KIND_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Module" htmlFor="moduleId" error={state.fieldErrors?.moduleId}>
          <Select
            id="moduleId"
            name="moduleId"
            defaultValue={resource?.moduleId ?? defaultModuleId ?? ''}
          >
            <option value="">Aucun module</option>
            {modules.map((m) => (
              <option key={m.id} value={m.id}>
                {m.code} — {m.name}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      {!isEdit ? (
        <>
          <Field
            label="Semestre"
            htmlFor="semesterId"
            error={state.fieldErrors?.semesterId}
            required
          >
            <Select
              id="semesterId"
              name="semesterId"
              defaultValue={defaultSemesterId ?? ''}
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

          <Field
            label="Fichier"
            htmlFor="file"
            hint={`${MAX_FILE_SIZE / 1024 / 1024} Mo maximum · ${ALLOWED_EXTENSIONS.join(', ')}`}
            required
          >
            <input
              id="file"
              name="file"
              type="file"
              required
              accept={ALLOWED_EXTENSIONS.join(',')}
              className="w-full text-[13px] text-[var(--text-2)] file:mr-3 file:rounded-lg file:border-0 file:bg-[var(--accent-soft)] file:px-3 file:py-2 file:text-[13px] file:font-medium file:text-[var(--accent-strong)] hover:file:brightness-95 cursor-pointer"
            />
          </Field>
        </>
      ) : (
        <p className="text-[12.5px] text-[var(--text-3)]">
          Le fichier déjà déposé n’est pas remplacé. Pour changer le fichier,
          supprimez la ressource et deposez-la a nouveau.
        </p>
      )}

      <div className="flex justify-end pt-1">
        <SubmitButton pendingLabel={isEdit ? 'Enregistrement...' : 'Depot en cours...'}>
          {isEdit ? 'Enregistrer' : 'Deposer la ressource'}
        </SubmitButton>
      </div>
    </form>
  )
}
