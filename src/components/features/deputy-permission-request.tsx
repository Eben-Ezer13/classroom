'use client'

import { requestDeputyPermissionAction } from '@/app/actions/deputy'
import { useFormAction } from '@/components/ui/use-form-action'
import { Button } from '@/components/ui/button'
import { Field, Input, Select } from '@/components/ui/field'
import { Alert } from '@/components/ui/feedback'

export function DeputyPermissionRequest() {
  const { state, formAction, pending } = useFormAction(requestDeputyPermissionAction)
  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      {state.message ? <div className="w-full"><Alert tone={state.ok ? 'success' : 'warning'}>{state.message}</Alert></div> : null}
      <Field label="Autorisation demandée" htmlFor="permission">
        <Select id="permission" name="permission" defaultValue="ECHEANCES">
          <option value="ECHEANCES">Gérer les échéances et examens</option>
          <option value="PROJETS">Gérer les projets</option>
        </Select>
      </Field>
      <Field label="Motif (facultatif)" htmlFor="message">
        <Input id="message" name="message" maxLength={500} placeholder="Expliquez brièvement la tâche" />
      </Field>
      <Button type="submit" disabled={pending}>{pending ? 'Envoi…' : 'Demander l’autorisation'}</Button>
    </form>
  )
}
