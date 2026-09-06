'use client'

import { useActionState, useEffect } from 'react'
import { Modal } from '@/components/ui/modal'
import { ConfirmForm, IconSubmit } from '@/components/ui/confirm-form'
import { IconPencil, IconPlus, IconTrash } from '@/components/ui/icons'
import { Field, Input, Select, Textarea } from '@/components/ui/field'
import { SubmitButton } from '@/components/ui/submit-button'
import { Alert } from '@/components/ui/feedback'
import { emptyActionState } from '@/lib/errors'
import {
  addProjectLinkAction,
  createProjectAction,
  deleteProjectAction,
  deleteProjectLinkAction,
  updateProjectAction,
} from '@/app/actions/projects'
import type { ModuleOption, SemesterOption } from '../programme/schedule-form'

export type ProjectFormValues = {
  id: string
  semesterId: string
  moduleId: string | null
  title: string
  description: string | null
  instructions: string | null
  teacherName: string | null
  startsAt: Date | null
  dueAt: Date
}

function toLocalInput(date: Date | null | undefined): string {
  if (!date) return ''
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16)
}

function ProjectForm({
  modules,
  semesters,
  defaultSemesterId,
  project,
  onDone,
}: {
  modules: ModuleOption[]
  semesters: SemesterOption[]
  defaultSemesterId: string | null
  project?: ProjectFormValues
  onDone?: () => void
}) {
  const isEdit = Boolean(project)
  const [state, formAction] = useActionState(
    isEdit ? updateProjectAction : createProjectAction,
    emptyActionState,
  )

  useEffect(() => {
    if (state.ok && onDone) onDone()
  }, [state.ok, onDone])

  return (
    <form action={formAction} className="space-y-4">
      {project ? <input type="hidden" name="projectId" value={project.id} /> : null}
      {state.message ? (
        <Alert tone={state.ok ? 'success' : 'danger'}>{state.message}</Alert>
      ) : null}

      <Field label="Titre" htmlFor="title" error={state.fieldErrors?.title} required>
        <Input
          id="title"
          name="title"
          defaultValue={project?.title ?? ''}
          required
          placeholder="Modélisation d’une suspension de véhicule électrique"
        />
      </Field>

      <Field label="Description" htmlFor="description" error={state.fieldErrors?.description}>
        <Textarea
          id="description"
          name="description"
          rows={3}
          defaultValue={project?.description ?? ''}
        />
      </Field>

      <Field
        label="Consignes"
        htmlFor="instructions"
        error={state.fieldErrors?.instructions}
        hint="Attendus, livrables, criteres d evaluation"
      >
        <Textarea
          id="instructions"
          name="instructions"
          rows={5}
          defaultValue={project?.instructions ?? ''}
        />
      </Field>

      <div className="grid sm:grid-cols-2 gap-3">
        <Field label="Semestre" htmlFor="semesterId" error={state.fieldErrors?.semesterId} required>
          <Select
            id="semesterId"
            name="semesterId"
            defaultValue={project?.semesterId ?? defaultSemesterId ?? ''}
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

        <Field label="Module" htmlFor="moduleId" error={state.fieldErrors?.moduleId}>
          <Select id="moduleId" name="moduleId" defaultValue={project?.moduleId ?? ''}>
            <option value="">Aucun module</option>
            {modules.map((m) => (
              <option key={m.id} value={m.id}>
                {m.code} — {m.name}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <Field label="Professeur" htmlFor="teacherName" error={state.fieldErrors?.teacherName}>
        <Input
          id="teacherName"
          name="teacherName"
          defaultValue={project?.teacherName ?? ''}
        />
      </Field>

      <div className="grid sm:grid-cols-2 gap-3">
        <Field label="Date de debut" htmlFor="startsAt" error={state.fieldErrors?.startsAt}>
          <Input
            id="startsAt"
            name="startsAt"
            type="datetime-local"
            defaultValue={toLocalInput(project?.startsAt)}
          />
        </Field>
        <Field label="Date limite" htmlFor="dueAt" error={state.fieldErrors?.dueAt} required>
          <Input
            id="dueAt"
            name="dueAt"
            type="datetime-local"
            defaultValue={toLocalInput(project?.dueAt)}
            required
          />
        </Field>
      </div>

      {!isEdit ? (
        <p className="text-[12.5px] text-[var(--text-3)]">
          Une échéance de rendu sera créée automatiquement à la date limite.
        </p>
      ) : null}

      <div className="flex justify-end pt-1">
        <SubmitButton pendingLabel="Enregistrement...">
          {isEdit ? 'Enregistrer' : 'Créer le projet'}
        </SubmitButton>
      </div>
    </form>
  )
}

type SharedProps = {
  modules: ModuleOption[]
  semesters: SemesterOption[]
  defaultSemesterId: string | null
}

export function AddProjectButton({
  modules,
  semesters,
  defaultSemesterId,
  autoOpen,
}: SharedProps & { autoOpen?: boolean }) {
  return (
    <Modal
      defaultOpen={autoOpen}
      trigger={
        <>
          <IconPlus className="size-4" />
          Nouveau projet
        </>
      }
      triggerSize="sm"
      title="Nouveau projet"
      description="Consignes, documents et compte a rebours pour toute la classe."
      width="lg"
    >
      {(close) => (
        <ProjectForm
          modules={modules}
          semesters={semesters}
          defaultSemesterId={defaultSemesterId}
          onDone={close}
        />
      )}
    </Modal>
  )
}

export function ProjectActions({
  project,
  modules,
  semesters,
  defaultSemesterId,
}: SharedProps & { project: ProjectFormValues }) {
  return (
    <div className="flex items-center gap-0.5">
      <Modal
        trigger={<IconPencil className="size-[17px]" />}
        triggerVariant="ghost"
        triggerSize="icon"
        title="Modifier le projet"
        width="lg"
      >
        {(close) => (
          <ProjectForm
            modules={modules}
            semesters={semesters}
            defaultSemesterId={defaultSemesterId}
            project={project}
            onDone={close}
          />
        )}
      </Modal>

      <ConfirmForm
        action={deleteProjectAction}
        hidden={{ projectId: project.id }}
        message="Supprimer ce projet et son échéance de rendu ?"
      >
        <IconSubmit label="Supprimer le projet" tone="danger">
          <IconTrash className="size-[17px]" />
        </IconSubmit>
      </ConfirmForm>
    </div>
  )
}

export function AddProjectLinkForm({ projectId }: { projectId: string }) {
  const [state, formAction] = useActionState(addProjectLinkAction, emptyActionState)

  return (
    <form action={formAction} className="space-y-2.5" key={state.ok ? 'sent' : 'draft'}>
      <input type="hidden" name="projectId" value={projectId} />
      {state.message && !state.ok ? <Alert tone="danger">{state.message}</Alert> : null}

      <div className="grid sm:grid-cols-[1fr_2fr] gap-2">
        <Input name="label" placeholder="Libelle" required aria-label="Libelle du lien" />
        <Input
          name="url"
          type="url"
          placeholder="https://..."
          required
          aria-label="Adresse du lien"
        />
      </div>
      <SubmitButton size="sm" variant="secondary" pendingLabel="Ajout...">
        Ajouter le lien
      </SubmitButton>
    </form>
  )
}

export function DeleteProjectLinkButton({ linkId }: { linkId: string }) {
  return (
    <ConfirmForm
      action={deleteProjectLinkAction}
      hidden={{ linkId }}
      message="Retirer ce lien ?"
    >
      <IconSubmit label="Retirer le lien" tone="danger">
        <IconTrash className="size-4" />
      </IconSubmit>
    </ConfirmForm>
  )
}
