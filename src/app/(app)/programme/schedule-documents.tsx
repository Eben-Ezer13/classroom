/* eslint-disable @next/next/no-img-element */
import Link from 'next/link'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/feedback'
import { IconCalendar, IconDownload } from '@/components/ui/icons'
import { formatDateTime, formatFileSize } from '@/lib/utils'
import {
  ScheduleDocumentActions,
  UploadScheduleDocumentButton,
} from './document-controls'
import type { SemesterOption } from './schedule-form'

export type ScheduleDocumentView = {
  id: string
  title: string
  note: string | null
  fileName: string
  fileSize: number
  mimeType: string
  isCurrent: boolean
  createdAt: Date
  uploadedBy: { firstName: string; lastName: string } | null
}

/**
 * Emploi du temps televerse : apercu, telechargement, remplacement.
 *
 * Le fichier n'est jamais reference par son URL de stockage : l'apercu
 * pointe vers /api/schedule-documents/<id>, qui verifie l'appartenance a la
 * classe avant de relayer le contenu.
 */
export function ScheduleDocuments({
  documents,
  canManage,
  semesters,
  defaultSemesterId,
}: {
  documents: ScheduleDocumentView[]
  canManage: boolean
  semesters: SemesterOption[]
  defaultSemesterId: string | null
}) {
  const current = documents.find((d) => d.isCurrent) ?? documents[0] ?? null
  const others = documents.filter((d) => d.id !== current?.id)

  if (!current && !canManage) return null

  return (
    <Card className="mb-4">
      <CardHeader
        title="Emploi du temps officiel"
        description={
          current
            ? `Mis à jour le ${formatDateTime(current.createdAt)}${
                current.uploadedBy
                  ? ` par ${current.uploadedBy.firstName} ${current.uploadedBy.lastName}`
                  : ''
              }`
            : 'Téléversez le planning reçu de votre établissement.'
        }
        action={
          canManage ? (
            <UploadScheduleDocumentButton
              semesters={semesters}
              defaultSemesterId={defaultSemesterId}
              hasDocument={Boolean(current)}
            />
          ) : null
        }
      />

      {!current ? (
        <EmptyState
          icon={<IconCalendar />}
          title="Aucun document téléversé"
          description="Une photo ou un PDF du planning officiel peut completer la saisie manuelle."
        />
      ) : (
        <CardBody className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[14px] font-medium text-[var(--text-1)]">{current.title}</p>
            <Badge tone="success">À jour</Badge>
            <span className="text-[12.5px] text-[var(--text-3)]">
              {current.fileName} · {formatFileSize(current.fileSize)}
            </span>
            <div className="ml-auto flex items-center gap-2">
              <Link
                href={`/api/schedule-documents/${current.id}?telecharger=1`}
                className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-[var(--accent)] hover:underline underline-offset-2"
              >
                <IconDownload className="size-4" />
                Télécharger
              </Link>
              {canManage ? (
                <ScheduleDocumentActions
                  documentId={current.id}
                  title={current.title}
                  isCurrent
                />
              ) : null}
            </div>
          </div>

          {current.note ? (
            <p className="text-[13px] text-[var(--text-2)] leading-relaxed">{current.note}</p>
          ) : null}

          <div className="rounded-xl border border-[var(--border)] overflow-hidden bg-[var(--surface-2)]">
            {current.mimeType === 'application/pdf' ? (
              <object
                data={`/api/schedule-documents/${current.id}`}
                type="application/pdf"
                className="w-full h-[70vh] min-h-[420px]"
                aria-label={current.title}
              >
                <p className="p-4 text-[13px] text-[var(--text-2)]">
                  L apercu PDF n est pas disponible sur cet appareil.{' '}
                  <Link
                    href={`/api/schedule-documents/${current.id}?telecharger=1`}
                    className="text-[var(--accent)] underline"
                  >
                    Télécharger le document
                  </Link>
                </p>
              </object>
            ) : (
              <img
                src={`/api/schedule-documents/${current.id}`}
                alt={current.title}
                className="w-full h-auto"
              />
            )}
          </div>

          {others.length > 0 ? (
            <details className="text-[13px]">
              <summary className="cursor-pointer text-[var(--text-2)] hover:text-[var(--text-1)]">
                Versions precedentes ({others.length})
              </summary>
              <ul className="mt-2 space-y-1.5">
                {others.map((document) => (
                  <li
                    key={document.id}
                    className="flex flex-wrap items-center gap-2 rounded-lg border border-[var(--border)] px-3 py-2"
                  >
                    <span className="text-[13px] text-[var(--text-1)]">{document.title}</span>
                    <span className="text-[12px] text-[var(--text-3)]">
                      {formatDateTime(document.createdAt)} ·{' '}
                      {formatFileSize(document.fileSize)}
                    </span>
                    <div className="ml-auto flex items-center gap-2">
                      <Link
                        href={`/api/schedule-documents/${document.id}`}
                        className="text-[12.5px] text-[var(--accent)] hover:underline"
                      >
                        Ouvrir
                      </Link>
                      {canManage ? (
                        <ScheduleDocumentActions
                          documentId={document.id}
                          title={document.title}
                          isCurrent={false}
                        />
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
        </CardBody>
      )}
    </Card>
  )
}
