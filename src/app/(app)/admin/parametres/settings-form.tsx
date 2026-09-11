'use client'

import { updateClassAction } from '@/app/actions/classes'
import { Field, Input, Textarea } from '@/components/ui/field'
import { SubmitButton } from '@/components/ui/submit-button'
import { Alert } from '@/components/ui/feedback'
import { useFormAction } from '@/components/ui/use-form-action'

export function ClassSettingsForm({
  defaults,
}: {
  defaults: {
    name: string
    schoolName: string
    programName: string
    levelName: string
    description: string
  }
}) {
  const { state, formAction, value } = useFormAction(updateClassAction)

  return (
    <form action={formAction} className="space-y-4">
      {state.message ? (
        <Alert tone={state.ok ? 'success' : 'danger'}>{state.message}</Alert>
      ) : null}

      <Field label="Nom de la classe" htmlFor="name" error={state.fieldErrors?.name} required>
        <Input
          id="name"
          name="name"
          required
          defaultValue={value('name', defaults.name)}
          maxLength={80}
        />
      </Field>

      <Field
        label="École / établissement"
        htmlFor="schoolName"
        error={state.fieldErrors?.schoolName}
        required
      >
        <Input
          id="schoolName"
          name="schoolName"
          required
          defaultValue={value('schoolName', defaults.schoolName)}
          maxLength={140}
        />
      </Field>

      <div className="grid sm:grid-cols-2 gap-3">
        <Field label="Filière" htmlFor="programName" error={state.fieldErrors?.programName}>
          <Input
            id="programName"
            name="programName"
            defaultValue={value('programName', defaults.programName)}
            maxLength={140}
          />
        </Field>
        <Field label="Niveau" htmlFor="levelName" error={state.fieldErrors?.levelName}>
          <Input
            id="levelName"
            name="levelName"
            defaultValue={value('levelName', defaults.levelName)}
            maxLength={80}
          />
        </Field>
      </div>

      <Field label="Description" htmlFor="description" error={state.fieldErrors?.description}>
        <Textarea
          id="description"
          name="description"
          rows={3}
          defaultValue={value('description', defaults.description)}
          maxLength={500}
        />
      </Field>

      <div className="flex justify-end">
        <SubmitButton pendingLabel="Enregistrement...">Enregistrer</SubmitButton>
      </div>
    </form>
  )
}
