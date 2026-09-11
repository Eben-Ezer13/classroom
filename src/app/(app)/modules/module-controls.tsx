'use client'

import { useEffect } from 'react'
import { Modal } from '@/components/ui/modal'
import { ConfirmForm, IconSubmit } from '@/components/ui/confirm-form'
import { IconPencil, IconPlus, IconTrash } from '@/components/ui/icons'
import { Field, Input, Select, Textarea } from '@/components/ui/field'
import { SubmitButton } from '@/components/ui/submit-button'
import { Alert } from '@/components/ui/feedback'
import { useFormAction } from '@/components/ui/use-form-action'
import { MODULE_COLORS } from '@/lib/constants'
import {
  createModuleAction,
  deleteModuleAction,
  updateModuleAction,
} from '@/app/actions/modules'
import type { SemesterOption } from '../programme/schedule-form'

export type ModuleFormValues = {
  id: string
  semesterId: string
  code: string
  name: string
  description: string | null
  teacherName: string | null
  teacherEmail: string | null
  credits: number | null
  color: string | null
}

function ModuleForm({
  semesters,
  defaultSemesterId,
  module,
  onDone,
}: {
  semesters: SemesterOption[]
  defaultSemesterId: string | null
  module?: ModuleFormValues
  onDone?: () => void
}) {
  const isEdit = Boolean(module)
  const { state, formAction, value } = useFormAction(
    isEdit ? updateModuleAction : createModuleAction,
  )

  useEffect(() => {
    if (state.ok && onDone) onDone()
  }, [state.ok, onDone])

  return (
    <form action={formAction} className="space-y-4">
      {module ? <input type="hidden" name="moduleId" value={module.id} /> : null}
      {state.message ? (
        <Alert tone={state.ok ? 'success' : 'danger'}>{state.message}</Alert>
      ) : null}

      <div className="grid grid-cols-[110px_1fr] gap-3">
        <Field label="Code" htmlFor="code" error={state.fieldErrors?.code} required>
          <Input
            id="code"
            name="code"
            defaultValue={value('code', module?.code)}
            required
            maxLength={20}
            placeholder="CAO"
          />
        </Field>
        <Field label="Intitulé" htmlFor="name" error={state.fieldErrors?.name} required>
          <Input
            id="name"
            name="name"
            defaultValue={value('name', module?.name)}
            required
            maxLength={120}
            placeholder="Conception assistée par ordinateur"
          />
        </Field>
      </div>

      <Field label="Semestre" htmlFor="semesterId" error={state.fieldErrors?.semesterId} required>
        <Select
          id="semesterId"
          name="semesterId"
          defaultValue={value('semesterId', module?.semesterId ?? defaultSemesterId)}
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

      <Field label="Description" htmlFor="description" error={state.fieldErrors?.description}>
        <Textarea
          id="description"
          name="description"
          rows={3}
          maxLength={1000}
          defaultValue={value('description', module?.description)}
          placeholder="Objectifs et contenu du module."
        />
      </Field>

      <div className="grid sm:grid-cols-2 gap-3">
        <Field label="Professeur" htmlFor="teacherName" error={state.fieldErrors?.teacherName}>
          <Input
            id="teacherName"
            name="teacherName"
            maxLength={120}
            defaultValue={value('teacherName', module?.teacherName)}
            placeholder="M. Alaoui"
          />
        </Field>
        <Field label="Email du professeur" htmlFor="teacherEmail" error={state.fieldErrors?.teacherEmail}>
          <Input
            id="teacherEmail"
            name="teacherEmail"
            type="email"
            maxLength={180}
            defaultValue={value('teacherEmail', module?.teacherEmail)}
          />
        </Field>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <Field label="Crédits" htmlFor="credits" error={state.fieldErrors?.credits}>
          <Input
            id="credits"
            name="credits"
            type="number"
            min={0}
            max={60}
            defaultValue={value('credits', module?.credits)}
          />
        </Field>
        <Field label="Couleur" htmlFor="color" hint="Distingue le module dans le programme">
          <Select id="color" name="color" defaultValue={value('color', module?.color ?? MODULE_COLORS[0])}>
            {MODULE_COLORS.map((color, i) => (
              <option key={color} value={color}>
                Couleur {i + 1}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <div className="flex justify-end pt-1">
        <SubmitButton pendingLabel="Enregistrement...">
          {isEdit ? 'Enregistrer' : 'Créer le module'}
        </SubmitButton>
      </div>
    </form>
  )
}

export function AddModuleButton({
  semesters,
  defaultSemesterId,
  autoOpen,
}: {
  semesters: SemesterOption[]
  defaultSemesterId: string | null
  autoOpen?: boolean
}) {
  return (
    <Modal
      defaultOpen={autoOpen}
      trigger={
        <>
          <IconPlus className="size-4" />
          Nouveau module
        </>
      }
      triggerSize="sm"
      title="Nouveau module"
      description="Un module regroupe cours, TD, TP, projets et annonces."
      width="lg"
    >
      {(close) => (
        <ModuleForm
          semesters={semesters}
          defaultSemesterId={defaultSemesterId}
          onDone={close}
        />
      )}
    </Modal>
  )
}

export function ModuleActions({
  module,
  semesters,
  defaultSemesterId,
}: {
  module: ModuleFormValues
  semesters: SemesterOption[]
  defaultSemesterId: string | null
}) {
  return (
    <div className="flex items-center gap-0.5">
      <Modal
        trigger={<IconPencil className="size-[17px]" />}
        triggerVariant="ghost"
        triggerSize="icon"
        title="Modifier le module"
        width="lg"
      >
        {(close) => (
          <ModuleForm
            semesters={semesters}
            defaultSemesterId={defaultSemesterId}
            module={module}
            onDone={close}
          />
        )}
      </Modal>

      <ConfirmForm
        action={deleteModuleAction}
        hidden={{ moduleId: module.id }}
        message="Supprimer ce module ? Il doit d’abord être détaché de ses ressources et séances."
      >
        <IconSubmit label="Supprimer le module" tone="danger">
          <IconTrash className="size-[17px]" />
        </IconSubmit>
      </ConfirmForm>
    </div>
  )
}
