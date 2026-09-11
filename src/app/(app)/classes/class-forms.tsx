'use client'

import { createClassAction, joinClassAction } from '@/app/actions/classes'
import { Field, Input, Textarea } from '@/components/ui/field'
import { SubmitButton } from '@/components/ui/submit-button'
import { Alert } from '@/components/ui/feedback'
import { useFormAction } from '@/components/ui/use-form-action'

export function CreateClassForm() {
  const { state, formAction, value } = useFormAction(createClassAction)

  return (
    <form action={formAction} className="space-y-4">
      {state.message && !state.ok ? <Alert tone="danger">{state.message}</Alert> : null}

      <Field
        label="Nom de la classe"
        htmlFor="name"
        error={state.fieldErrors?.name}
        hint="Exemple : GSMI 4A"
        required
      >
        <Input
          id="name"
          name="name"
          required
          placeholder="GSMI 4A"
          maxLength={80}
          defaultValue={value('name')}
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
          placeholder="ENSAM Casablanca"
          maxLength={140}
          defaultValue={value('schoolName')}
        />
      </Field>

      <div className="grid sm:grid-cols-2 gap-3">
        <Field label="Filière" htmlFor="programName" error={state.fieldErrors?.programName}>
          <Input
            id="programName"
            name="programName"
            placeholder="Génie mécanique"
            maxLength={140}
            defaultValue={value('programName')}
          />
        </Field>
        <Field label="Niveau" htmlFor="levelName" error={state.fieldErrors?.levelName}>
          <Input
            id="levelName"
            name="levelName"
            placeholder="4e année"
            maxLength={80}
            defaultValue={value('levelName')}
          />
        </Field>
      </div>

      <Field
        label="Année académique"
        htmlFor="academicYearLabel"
        error={state.fieldErrors?.academicYearLabel}
        hint="Deux semestres sont créés automatiquement ; vous pourrez les ajuster."
        required
      >
        <Input
          id="academicYearLabel"
          name="academicYearLabel"
          required
          placeholder="2026/2027"
          maxLength={20}
          defaultValue={value('academicYearLabel')}
        />
      </Field>

      <Field
        label="Description"
        htmlFor="description"
        error={state.fieldErrors?.description}
        hint="Facultatif"
      >
        <Textarea
          id="description"
          name="description"
          rows={3}
          maxLength={500}
          defaultValue={value('description')}
        />
      </Field>

      <SubmitButton className="w-full" pendingLabel="Création de l’espace...">
        Créer ma classe
      </SubmitButton>
    </form>
  )
}

export function JoinClassForm({
  defaultCode,
  variant = 'secondary',
}: {
  /** Code pre-rempli (lien d'invitation). */
  defaultCode?: string
  variant?: 'primary' | 'secondary'
}) {
  const { state, formAction, value } = useFormAction(joinClassAction)

  return (
    <form action={formAction} className="space-y-4">
      {state.message && !state.ok ? <Alert tone="danger">{state.message}</Alert> : null}

      <Field
        label="Code de classe ou d’invitation"
        htmlFor="code"
        error={state.fieldErrors?.code}
        hint="Fourni par votre délégué"
        required
      >
        <Input
          id="code"
          name="code"
          required
          defaultValue={value('code', defaultCode)}
          placeholder="A1B2C3D4"
          className="uppercase tracking-[0.15em] font-mono"
          maxLength={40}
        />
      </Field>

      <Field
        label="Numéro étudiant"
        htmlFor="studentId"
        error={state.fieldErrors?.studentId}
        hint="Facultatif"
      >
        <Input
          id="studentId"
          name="studentId"
          placeholder="20260145"
          maxLength={40}
          defaultValue={value('studentId')}
        />
      </Field>

      <SubmitButton className="w-full" variant={variant} pendingLabel="Vérification...">
        Rejoindre la classe
      </SubmitButton>
    </form>
  )
}
