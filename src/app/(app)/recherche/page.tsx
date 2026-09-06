import type { Metadata } from 'next'
import Link from 'next/link'
import { requirePageUser } from '@/lib/auth/guards'
import { globalSearch, type SearchScope } from '@/lib/services/search'
import { getClassModules, getClassSemesters } from '@/lib/services/class-context'
import { PageHeader } from '@/components/layout/page-header'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/feedback'
import { Pagination } from '@/components/ui/pagination'
import { Badge } from '@/components/ui/badge'
import { Input, Select } from '@/components/ui/field'
import { NoClassState } from '@/components/ui/no-class'
import { FilterBar, FilterField } from '@/components/features/filter-bar'
import { ResourceItem } from '@/components/features/resource-item'
import { AnnouncementCard } from '@/components/features/announcement-card'
import { IconSearch } from '@/components/ui/icons'
import { RESOURCE_KIND_LABELS } from '@/lib/constants'
import { cn, formatCountdown, normalizeSearch, truncate } from '@/lib/utils'

export const metadata: Metadata = { title: 'Recherche' }

const SCOPES: Array<{ key: SearchScope; label: string }> = [
  { key: 'tout', label: 'Tout' },
  { key: 'ressources', label: 'Ressources' },
  { key: 'modules', label: 'Modules' },
  { key: 'projets', label: 'Projets' },
  { key: 'annonces', label: 'Annonces' },
]

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>
}) {
  const user = await requirePageUser()
  const raw = await searchParams

  if (!user.classGroupId) {
    return (
      <>
        <PageHeader title="Recherche" />
        <NoClassState />
      </>
    )
  }

  const q = normalizeSearch(raw.q)
  const scope = (SCOPES.find((s) => s.key === raw.scope)?.key ?? 'tout') as SearchScope
  const pageRaw = Number(raw.page ?? '1')
  const page = Number.isFinite(pageRaw) ? Math.max(1, Math.floor(pageRaw)) : 1

  const [results, modules, semesters] = await Promise.all([
    globalSearch(user.classGroupId, {
      q,
      scope,
      moduleId: raw.moduleId || undefined,
      semesterId: raw.semesterId || undefined,
      kind: raw.kind || undefined,
      from: raw.from || undefined,
      to: raw.to || undefined,
      page,
    }),
    getClassModules(user.classGroupId),
    getClassSemesters(user.classGroupId),
  ])

  const commonParams = {
    q: q || undefined,
    scope: scope === 'tout' ? undefined : scope,
    moduleId: raw.moduleId || undefined,
    semesterId: raw.semesterId || undefined,
    kind: raw.kind || undefined,
    from: raw.from || undefined,
    to: raw.to || undefined,
  }

  const scopeTotal =
    scope === 'ressources'
      ? results.resources.total
      : scope === 'modules'
        ? results.modules.total
        : scope === 'projets'
          ? results.projects.total
          : scope === 'annonces'
            ? results.announcements.total
            : results.total

  return (
    <>
      <PageHeader
        title="Recherche"
        description="Ressources, modules, projets et annonces de votre classe."
      />

      <FilterBar
        action="/recherche"
        hasFilters={Boolean(
          q || raw.moduleId || raw.semesterId || raw.kind || raw.from || raw.to,
        )}
      >
        <input type="hidden" name="scope" value={scope} />
        <FilterField label="Mots-cles" htmlFor="q" className="min-w-[220px] flex-[2]">
          <Input id="q" name="q" defaultValue={q} placeholder="Rechercher..." autoFocus />
        </FilterField>
        <FilterField label="Module" htmlFor="moduleId">
          <Select id="moduleId" name="moduleId" defaultValue={raw.moduleId ?? ''}>
            <option value="">Tous</option>
            {modules.map((m) => (
              <option key={m.id} value={m.id}>
                {m.code}
              </option>
            ))}
          </Select>
        </FilterField>
        <FilterField label="Semestre" htmlFor="semesterId">
          <Select id="semesterId" name="semesterId" defaultValue={raw.semesterId ?? ''}>
            <option value="">Tous</option>
            {semesters.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label} — {s.academicYear.label}
              </option>
            ))}
          </Select>
        </FilterField>
        <FilterField label="Type" htmlFor="kind">
          <Select id="kind" name="kind" defaultValue={raw.kind ?? ''}>
            <option value="">Tous</option>
            {Object.entries(RESOURCE_KIND_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </FilterField>
        <FilterField label="Du" htmlFor="from" className="min-w-[140px]">
          <Input id="from" name="from" type="date" defaultValue={raw.from ?? ''} />
        </FilterField>
        <FilterField label="Au" htmlFor="to" className="min-w-[140px]">
          <Input id="to" name="to" type="date" defaultValue={raw.to ?? ''} />
        </FilterField>
      </FilterBar>

      <div className="flex items-center gap-1 mb-4 overflow-x-auto pb-1">
        {SCOPES.map((s) => {
          const search = new URLSearchParams()
          for (const [key, value] of Object.entries(commonParams)) {
            if (value && key !== 'scope') search.set(key, value)
          }
          if (s.key !== 'tout') search.set('scope', s.key)
          const count =
            s.key === 'ressources'
              ? results.resources.total
              : s.key === 'modules'
                ? results.modules.total
                : s.key === 'projets'
                  ? results.projects.total
                  : s.key === 'annonces'
                    ? results.announcements.total
                    : results.total
          return (
            <Link
              key={s.key}
              href={`/recherche?${search.toString()}`}
              className={cn(
                'shrink-0 rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors',
                s.key === scope
                  ? 'bg-[var(--accent-soft)] text-[var(--accent-strong)]'
                  : 'text-[var(--text-2)] hover:bg-[var(--surface-3)]',
              )}
            >
              {s.label}
              {q ? <span className="ml-1.5 tabular-nums opacity-70">{count}</span> : null}
            </Link>
          )
        })}
      </div>

      {!q ? (
        <Card>
          <EmptyState
            icon={<IconSearch />}
            title="Lancez une recherche"
            description="Saisissez un mot-cle pour retrouver un document, un module, un projet ou une annonce."
          />
        </Card>
      ) : scopeTotal === 0 ? (
        <Card>
          <EmptyState
            icon={<IconSearch />}
            title="Aucun resultat"
            description={`Aucun element ne correspond a "${q}" avec ces filtres.`}
          />
        </Card>
      ) : (
        <div className="space-y-4">
          {(scope === 'tout' || scope === 'ressources') && results.resources.items.length > 0 ? (
            <Card>
              <CardHeader
                title="Ressources"
                description={`${results.resources.total} resultat(s)`}
              />
              <CardBody className="space-y-2.5">
                {results.resources.items.map((resource) => (
                  <ResourceItem key={resource.id} resource={resource} />
                ))}
              </CardBody>
              {scope === 'ressources' ? (
                <Pagination
                  page={page}
                  pageCount={Math.max(
                    1,
                    Math.ceil(results.resources.total / (results.perPage ?? 10)),
                  )}
                  total={results.resources.total}
                  basePath="/recherche"
                  params={commonParams}
                />
              ) : null}
            </Card>
          ) : null}

          {(scope === 'tout' || scope === 'modules') && results.modules.items.length > 0 ? (
            <Card>
              <CardHeader title="Modules" description={`${results.modules.total} resultat(s)`} />
              <CardBody className="grid sm:grid-cols-2 gap-2.5">
                {results.modules.items.map((mod) => (
                  <Link
                    key={mod.id}
                    href={`/modules/${mod.id}`}
                    className="flex items-start gap-3 rounded-xl border border-[var(--border)] p-3.5 hover:bg-[var(--surface-2)] transition-colors"
                  >
                    <span
                      className="size-9 rounded-lg grid place-items-center text-[11px] font-bold text-white shrink-0"
                      style={{ background: mod.color ?? 'var(--accent)' }}
                    >
                      {mod.code.slice(0, 3)}
                    </span>
                    <div className="min-w-0">
                      <p className="text-[13.5px] font-medium text-[var(--text-1)]">
                        {mod.name}
                      </p>
                      <p className="mt-0.5 text-[12px] text-[var(--text-3)]">
                        {[mod.code, mod.teacherName, mod.semester.label]
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                    </div>
                  </Link>
                ))}
              </CardBody>
              {scope === 'modules' ? (
                <Pagination
                  page={page}
                  pageCount={Math.max(
                    1,
                    Math.ceil(results.modules.total / (results.perPage ?? 10)),
                  )}
                  total={results.modules.total}
                  basePath="/recherche"
                  params={commonParams}
                />
              ) : null}
            </Card>
          ) : null}

          {(scope === 'tout' || scope === 'projets') && results.projects.items.length > 0 ? (
            <Card>
              <CardHeader title="Projets" description={`${results.projects.total} resultat(s)`} />
              <CardBody className="space-y-2.5">
                {results.projects.items.map((project) => (
                  <Link
                    key={project.id}
                    href={`/projets/${project.id}`}
                    className="flex items-start justify-between gap-3 rounded-xl border border-[var(--border)] p-3.5 hover:bg-[var(--surface-2)] transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="text-[13.5px] font-medium text-[var(--text-1)]">
                        {project.title}
                      </p>
                      {project.description ? (
                        <p className="mt-1 text-[12.5px] text-[var(--text-2)]">
                          {truncate(project.description, 120)}
                        </p>
                      ) : null}
                      {project.module ? (
                        <Badge tone="info" className="mt-1.5">
                          {project.module.code}
                        </Badge>
                      ) : null}
                    </div>
                    <span className="shrink-0 text-[12.5px] font-medium text-[var(--warning)]">
                      {formatCountdown(project.dueAt)}
                    </span>
                  </Link>
                ))}
              </CardBody>
              {scope === 'projets' ? (
                <Pagination
                  page={page}
                  pageCount={Math.max(
                    1,
                    Math.ceil(results.projects.total / (results.perPage ?? 10)),
                  )}
                  total={results.projects.total}
                  basePath="/recherche"
                  params={commonParams}
                />
              ) : null}
            </Card>
          ) : null}

          {(scope === 'tout' || scope === 'annonces') &&
          results.announcements.items.length > 0 ? (
            <Card>
              <CardHeader
                title="Annonces"
                description={`${results.announcements.total} resultat(s)`}
              />
              <CardBody className="space-y-3">
                {results.announcements.items.map((announcement) => (
                  <AnnouncementCard key={announcement.id} announcement={announcement} compact />
                ))}
              </CardBody>
              {scope === 'annonces' ? (
                <Pagination
                  page={page}
                  pageCount={Math.max(
                    1,
                    Math.ceil(results.announcements.total / (results.perPage ?? 10)),
                  )}
                  total={results.announcements.total}
                  basePath="/recherche"
                  params={commonParams}
                />
              ) : null}
            </Card>
          ) : null}
        </div>
      )}
    </>
  )
}
