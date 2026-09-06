import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { requirePageUser } from '@/lib/auth/guards'
import { getComplaintDetail, loadComplaintFor } from '@/lib/services/complaints'
import { NotFoundError } from '@/lib/errors'
import { PageHeader } from '@/components/layout/page-header'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { Badge, toTone } from '@/components/ui/badge'
import { Avatar } from '@/components/ui/avatar'
import { Alert } from '@/components/ui/feedback'
import { IconDownload, IconFile } from '@/components/ui/icons'
import {
  COMPLAINT_CATEGORY_LABELS,
  COMPLAINT_PRIORITY_LABELS,
  COMPLAINT_PRIORITY_TONE,
  COMPLAINT_STATUS_LABELS,
  COMPLAINT_STATUS_TONE,
  ROLE_LABELS,
} from '@/lib/constants'
import { formatDateTime, formatFileSize, formatRelative } from '@/lib/utils'
import { ComplaintMessageForm, ComplaintStatusForm } from '../complaint-controls'

export const metadata: Metadata = { title: 'Réclamation' }

export default async function ComplaintDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const user = await requirePageUser()
  const { id } = await params

  // loadComplaintFor applique la regle d'acces : un etudiant qui tente
  // l'identifiant d'un camarade obtient un 404.
  let access
  try {
    access = await loadComplaintFor(user, id)
  } catch (error) {
    if (error instanceof NotFoundError) notFound()
    throw error
  }

  const complaint = await getComplaintDetail(id)
  if (!complaint) notFound()

  const isStaff = access.isStaff
  const isClosed = complaint.status === 'FERME'

  return (
    <>
      <PageHeader
        title={complaint.title}
        breadcrumb={[
          { label: 'Réclamations', href: '/reclamations' },
          { label: 'Detail' },
        ]}
      />

      <div className="grid lg:grid-cols-[1fr_290px] gap-4">
        <div className="space-y-4">
          <Card>
            <CardHeader
              title="Signalement initial"
              description={`${complaint.author.firstName} ${complaint.author.lastName} · ${formatDateTime(complaint.createdAt)}`}
            />
            <CardBody>
              <p className="text-[13.5px] text-[var(--text-2)] leading-relaxed whitespace-pre-line">
                {complaint.description}
              </p>

              {complaint.attachments.length > 0 ? (
                <div className="mt-4 space-y-2">
                  <p className="text-[11.5px] font-semibold uppercase tracking-wide text-[var(--text-3)]">
                    Pieces jointes
                  </p>
                  {complaint.attachments.map((attachment) => (
                    <a
                      key={attachment.id}
                      href={`/api/attachments/${attachment.id}/download`}
                      className="flex items-center gap-2.5 rounded-lg border border-[var(--border)] px-3 py-2 hover:bg-[var(--surface-2)] transition-colors"
                    >
                      <IconFile className="size-4 text-[var(--text-3)] shrink-0" />
                      <span className="text-[13px] text-[var(--text-1)] truncate flex-1">
                        {attachment.fileName}
                      </span>
                      <span className="text-[12px] text-[var(--text-3)] shrink-0">
                        {formatFileSize(attachment.fileSize)}
                      </span>
                      <IconDownload className="size-4 text-[var(--accent)] shrink-0" />
                    </a>
                  ))}
                </div>
              ) : null}
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Echanges"
              description={
                complaint.messages.length === 0
                  ? 'Aucun message pour le moment.'
                  : `${complaint.messages.length} message(s)`
              }
            />
            <CardBody className="space-y-4">
              {complaint.messages.map((message) => (
                <div key={message.id} className="flex gap-3">
                  <Avatar
                    firstName={message.author?.firstName ?? '?'}
                    lastName={message.author?.lastName ?? '?'}
                    src={
                      message.author?.avatarUrl
                        ? `/api/users/${message.author.id}/avatar`
                        : null
                    }
                    size="sm"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[13px] font-medium text-[var(--text-1)]">
                        {message.author
                          ? `${message.author.firstName} ${message.author.lastName}`
                          : 'Compte supprime'}
                      </span>
                      {message.author && message.author.role !== 'ETUDIANT' ? (
                        <Badge tone="accent">{ROLE_LABELS[message.author.role]}</Badge>
                      ) : null}
                      <span className="text-[11.5px] text-[var(--text-3)]">
                        {formatRelative(message.createdAt)}
                      </span>
                    </div>
                    <p className="mt-1 text-[13.5px] text-[var(--text-2)] leading-relaxed whitespace-pre-line">
                      {message.body}
                    </p>
                  </div>
                </div>
              ))}

              <div className="pt-2 border-t border-[var(--border)]">
                {isClosed ? (
                  <Alert tone="neutral">
                    Cette réclamation est fermée : elle n’accepte plus de nouveaux messages.
                  </Alert>
                ) : (
                  <ComplaintMessageForm complaintId={complaint.id} />
                )}
              </div>
            </CardBody>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader title="Suivi" />
            <CardBody className="space-y-3">
              <Row label="Statut">
                <Badge tone={toTone(COMPLAINT_STATUS_TONE[complaint.status])}>
                  {COMPLAINT_STATUS_LABELS[complaint.status]}
                </Badge>
              </Row>
              <Row label="Priorite">
                <Badge tone={toTone(COMPLAINT_PRIORITY_TONE[complaint.priority])}>
                  {COMPLAINT_PRIORITY_LABELS[complaint.priority]}
                </Badge>
              </Row>
              <Row label="Categorie">
                <span className="text-[13px] text-[var(--text-1)]">
                  {COMPLAINT_CATEGORY_LABELS[complaint.category]}
                </span>
              </Row>
              <Row label="Ouverte le">
                <span className="text-[13px] text-[var(--text-1)]">
                  {formatDateTime(complaint.createdAt)}
                </span>
              </Row>
              {complaint.assignedTo ? (
                <Row label="Prise en charge">
                  <span className="text-[13px] text-[var(--text-1)]">
                    {complaint.assignedTo.firstName} {complaint.assignedTo.lastName}
                  </span>
                </Row>
              ) : null}
              {complaint.resolvedAt ? (
                <Row label="Resolue le">
                  <span className="text-[13px] text-[var(--text-1)]">
                    {formatDateTime(complaint.resolvedAt)}
                  </span>
                </Row>
              ) : null}
            </CardBody>
          </Card>

          {isStaff ? (
            <Card>
              <CardHeader title="Traitement" description="Reserve aux responsables" />
              <CardBody>
                <ComplaintStatusForm complaintId={complaint.id} status={complaint.status} />
              </CardBody>
            </Card>
          ) : null}
        </div>
      </div>
    </>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[12.5px] text-[var(--text-3)]">{label}</span>
      {children}
    </div>
  )
}
