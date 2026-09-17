/* eslint-disable @next/next/no-img-element */
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/feedback'
import { buttonClasses } from '@/components/ui/button'
import { IconCalendar, IconDownload, IconFile } from '@/components/ui/icons'
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
          description="Une photo ou un PDF du planning officiel peut compléter la saisie manuelle."
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
              <a
                href={`/api/schedule-documents/${current.id}?telecharger=1`}
                className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-[var(--accent)] hover:underline underline-offset-2"
              >
                <IconDownload className="size-4" />
                Télécharger
              </a>
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

          {current.mimeType === 'application/pdf' ? (
            // Pas d'apercu integre : la politique de securite du site interdit
            // l'integration de documents (object-src, frame-ancestors), et la
            // plupart des navigateurs mobiles n'affichent pas un PDF integre.
            <div className="flex flex-wrap items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-4">
              <IconFile className="size-5 text-[var(--text-3)] shrink-0" />
              <p className="flex-1 min-w-[180px] text-[13px] text-[var(--text-2)]">
                Document PDF : ouvrez-le dans un nouvel onglet pour le consulter.
              </p>
              <a
                href={`/api/schedule-documents/${current.id}`}
                target="_blank"
                rel="noopener"
                className={buttonClasses('primary', 'sm')}
              >
                Ouvrir le PDF
              </a>
            </div>
          ) : (
            <a
              href={`/api/schedule-documents/${current.id}`}
              target="_blank"
              rel="noopener"
              className="block rounded-xl border border-[var(--border)] overflow-hidden bg-[var(--surface-2)]"
              title="Afficher en grand"
            >
              <img
                src={`/api/schedule-documents/${current.id}`}
                alt={current.title}
                className="w-full h-auto"
              />
            </a>
          )}

          {others.length > 0 ? (
            <details className="text-[13px]">
              <summary className="cursor-pointer text-[var(--text-2)] hover:text-[var(--text-1)]">
                Versions précédentes ({others.length})
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
                      <a
                        href={`/api/schedule-documents/${document.id}`}
                        target="_blank"
                        rel="noopener"
                        className="text-[12.5px] text-[var(--accent)] hover:underline"
                      >
                        Ouvrir
                      </a>
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
