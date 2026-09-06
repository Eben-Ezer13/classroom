'use client'

import { Modal } from '@/components/ui/modal'
import { ConfirmForm, IconSubmit } from '@/components/ui/confirm-form'
import { IconArchive, IconPencil, IconPlus, IconTrash } from '@/components/ui/icons'
import {
  deleteResourceAction,
  toggleResourceArchiveAction,
} from '@/app/actions/resources'
import { ResourceForm, type ResourceFormValues } from './resource-form'
import type { ModuleOption, SemesterOption } from '../programme/schedule-form'

type SharedProps = {
  modules: ModuleOption[]
  semesters: SemesterOption[]
  defaultSemesterId: string | null
}

export function AddResourceButton({
  modules,
  semesters,
  defaultSemesterId,
  defaultModuleId,
  autoOpen,
  label = 'Ajouter une ressource',
}: SharedProps & { defaultModuleId?: string; autoOpen?: boolean; label?: string }) {
  return (
    <Modal
      defaultOpen={autoOpen}
      trigger={
        <>
          <IconPlus className="size-4" />
          {label}
        </>
      }
      triggerSize="sm"
      title="Nouvelle ressource"
      description="Le fichier sera accessible aux membres de la classe."
      width="lg"
    >
      {(close) => (
        <ResourceForm
          modules={modules}
          semesters={semesters}
          defaultSemesterId={defaultSemesterId}
          defaultModuleId={defaultModuleId}
          onDone={close}
        />
      )}
    </Modal>
  )
}

export function ResourceActions({
  resource,
  modules,
  semesters,
  defaultSemesterId,
  isArchived,
}: SharedProps & { resource: ResourceFormValues; isArchived: boolean }) {
  return (
    <>
      <Modal
        trigger={<IconPencil className="size-[17px]" />}
        triggerVariant="ghost"
        triggerSize="icon"
        title="Modifier la ressource"
        width="lg"
      >
        {(close) => (
          <ResourceForm
            modules={modules}
            semesters={semesters}
            defaultSemesterId={defaultSemesterId}
            resource={resource}
            onDone={close}
          />
        )}
      </Modal>

      <ConfirmForm
        action={toggleResourceArchiveAction}
        hidden={{ resourceId: resource.id }}
        message={
          isArchived
            ? 'Sortir cette ressource des archives ?'
            : 'Archiver cette ressource ? Elle sera masquee de la liste courante.'
        }
      >
        <IconSubmit label={isArchived ? 'Desarchiver' : 'Archiver'}>
          <IconArchive className="size-[17px]" />
        </IconSubmit>
      </ConfirmForm>

      <ConfirmForm
        action={deleteResourceAction}
        hidden={{ resourceId: resource.id }}
        message="Supprimer definitivement cette ressource et son fichier ?"
      >
        <IconSubmit label="Supprimer la ressource" tone="danger">
          <IconTrash className="size-[17px]" />
        </IconSubmit>
      </ConfirmForm>
    </>
  )
}
