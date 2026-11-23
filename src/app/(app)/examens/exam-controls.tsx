'use client'

import { createExamAction, deleteExamAction } from '@/app/actions/exams'
import { useFormAction } from '@/components/ui/use-form-action'
import { Button } from '@/components/ui/button'
import { Field, Input, Select } from '@/components/ui/field'
import { Alert } from '@/components/ui/feedback'
import { ActionForm } from '@/components/ui/confirm-form'

export type ModuleOption = { id: string; code: string; name: string }

export function ExamForm({ modules }: { modules: ModuleOption[] }) {
  const { state, formAction, pending, value } = useFormAction(createExamAction)
  return <form action={formAction} className="grid gap-3 sm:grid-cols-2">
    {state.message ? <div className="sm:col-span-2"><Alert tone={state.ok ? 'success' : 'danger'}>{state.message}</Alert></div> : null}
    <Field label="Nom de l’examen" htmlFor="title" required><Input id="title" name="title" maxLength={120} defaultValue={value('title')} placeholder="Examen final" /></Field>
    <Field label="Module" htmlFor="moduleId"><Select id="moduleId" name="moduleId" defaultValue={value('moduleId')}><option value="">Sans module</option>{modules.map((module) => <option key={module.id} value={module.id}>{module.code} · {module.name}</option>)}</Select></Field>
    <Field label="Date et heure" htmlFor="startsAt" required><Input id="startsAt" name="startsAt" type="datetime-local" required defaultValue={value('startsAt')} /></Field>
    <div className="flex items-end"><Button disabled={pending}>{pending ? 'Enregistrement…' : 'Ajouter l’examen'}</Button></div>
  </form>
}

export function DeleteExamButton({ examId }: { examId: string }) {
  return <ActionForm action={deleteExamAction} hidden={{ examId }} confirm="Supprimer cet examen et ses rappels ?"><Button size="sm" variant="ghost">Supprimer</Button></ActionForm>
}
