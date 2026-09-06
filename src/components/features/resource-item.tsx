import type { ReactNode } from 'react'
import { Badge } from '@/components/ui/badge'
import { RESOURCE_KIND_LABELS } from '@/lib/constants'
import { formatFileSize, formatRelative } from '@/lib/utils'
import { IconDownload, IconFile } from '@/components/ui/icons'

export type ResourceData = {
  id: string
  title: string
  kind: string
  fileSize: number
  createdAt: Date
  description?: string | null
  downloadCount?: number
  module: { code: string; name: string } | null
  uploadedBy?: { firstName: string; lastName: string } | null
}

export function ResourceItem({
  resource,
  actions,
}: {
  resource: ResourceData
  actions?: ReactNode
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-1)] p-3.5 hover:bg-[var(--surface-2)] transition-colors">
      <span className="mt-0.5 size-9 shrink-0 rounded-lg bg-[var(--surface-3)] text-[var(--text-3)] grid place-items-center">
        <IconFile className="size-[18px]" />
      </span>

      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-medium text-[var(--text-1)] leading-snug">
          {resource.title}
        </p>
        {resource.description ? (
          <p className="mt-1 text-[12.5px] text-[var(--text-2)] line-clamp-2 leading-relaxed">
            {resource.description}
          </p>
        ) : null}
        <div className="mt-2 flex items-center gap-2 flex-wrap">
          <Badge tone="accent">
            {RESOURCE_KIND_LABELS[resource.kind] ?? resource.kind}
          </Badge>
          {resource.module ? <Badge tone="info">{resource.module.code}</Badge> : null}
          <span className="text-[12px] text-[var(--text-3)]">
            {formatFileSize(resource.fileSize)} · {formatRelative(resource.createdAt)}
            {typeof resource.downloadCount === 'number'
              ? ` · ${resource.downloadCount} téléchargement${resource.downloadCount > 1 ? 's' : ''}`
              : ''}
          </span>
        </div>
      </div>

      <div className="shrink-0 flex items-center gap-1">
        <a
          href={`/api/resources/${resource.id}/download`}
          className="size-8 grid place-items-center rounded-lg text-[var(--text-3)] hover:bg-[var(--surface-3)] hover:text-[var(--accent)] transition-colors"
          title="Télécharger"
          aria-label={`Télécharger ${resource.title}`}
        >
          <IconDownload className="size-[17px]" />
        </a>
        {actions}
      </div>
    </div>
  )
}
