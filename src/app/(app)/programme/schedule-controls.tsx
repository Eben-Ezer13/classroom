'use client'

import { Modal } from '@/components/ui/modal'
import { ConfirmForm, IconSubmit } from '@/components/ui/confirm-form'
import { IconPencil, IconPlus, IconTrash } from '@/components/ui/icons'
import { deleteScheduleEntryAction } from '@/app/actions/schedule'
import {
  ScheduleForm,
  type ModuleOption,
  type ScheduleFormValues,
  type SemesterOption,
} from './schedule-form'

type SharedProps = {
  modules: ModuleOption[]
  semesters: SemesterOption[]
  defaultSemesterId: string | null
}

export function AddScheduleButton({
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
          Ajouter une séance
        </>
      }
      triggerSize="sm"
      title="Nouvelle séance"
      description="Elle apparaîtra dans le programme de la classe."
      width="lg"
    >
      {(close) => (
        <ScheduleForm
          modules={modules}
          semesters={semesters}
          defaultSemesterId={defaultSemesterId}
          onDone={close}
        />
      )}
    </Modal>
  )
}

export function ScheduleEntryActions({
  entry,
  modules,
  semesters,
  defaultSemesterId,
}: SharedProps & { entry: ScheduleFormValues }) {
  return (
    <div className="flex items-center gap-0.5">
      <Modal
        trigger={<IconPencil className="size-[17px]" />}
        triggerVariant="ghost"
        triggerSize="icon"
        title="Modifier la séance"
        width="lg"
      >
        {(close) => (
          <ScheduleForm
            modules={modules}
            semesters={semesters}
            defaultSemesterId={defaultSemesterId}
            entry={entry}
            onDone={close}
          />
        )}
      </Modal>

      <ConfirmForm
        action={deleteScheduleEntryAction}
        hidden={{ entryId: entry.id }}
        message="Supprimer cette séance ? La classe sera prévenue."
      >
        <IconSubmit label="Supprimer la seance" tone="danger">
          <IconTrash className="size-[17px]" />
        </IconSubmit>
      </ConfirmForm>
    </div>
  )
}
