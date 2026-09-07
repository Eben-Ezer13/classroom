import type { Metadata } from 'next'
import { requirePageUser } from '@/lib/auth/guards'
import { listResources } from '@/lib/services/resources'
import {
  getClassModules,
  getClassSemesters,
  getDefaultSemesterId,
} from '@/lib/services/class-context'
import { PageHeader } from '@/components/layout/page-header'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/feedback'
import { Pagination } from '@/components/ui/pagination'
import { Input, Select } from '@/components/ui/field'
import { NoClassState } from '@/components/ui/no-class'
import { FilterBar, FilterField } from '@/components/features/filter-bar'
import { ResourceItem } from '@/components/features/resource-item'
import { IconFolder } from '@/components/ui/icons'
import { RESOURCE_KIND_LABELS } from '@/lib/constants'
import { searchSchema } from '@/lib/validation'
import { AddResourceButton, ResourceActions } from './resource-controls'

export const metadata: Metadata = { title: 'Ressources' }

export default async function ResourcesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>
}) {
  const user = await requirePageUser()
  const raw = await searchParams

  if (!user.classGroupId) {
    return (
      <>
        <PageHeader title="Ressources" />
        <NoClassState />
      </>
    )
  }

  // Seul le delegue de la classe active peut gerer le contenu.
  const canManage = user.role === 'ADMIN'
  const filters = searchSchema.parse(raw)
  const includeArchived = raw.archives === '1'

  const [result, modules, semesters, defaultSemesterId] = await Promise.all([
    listResources(user.classGroupId, { ...filters, includeArchived }),
    getClassModules(user.classGroupId),
    getClassSemesters(user.classGroupId),
    getDefaultSemesterId(user.classGroupId),
  ])

  const moduleOptions = modules.map((m) => ({ id: m.id, code: m.code, name: m.name }))
  const semesterOptions = semesters.map((s) => ({
    id: s.id,
    label: s.label,
    academicYear: { label: s.academicYear.label },
  }))

  const hasFilters = Boolean(
    filters.q || filters.moduleId || filters.semesterId || filters.kind || includeArchived,
  )

  return (
    <>
      <PageHeader
        title="Ressources"
        description="Cours, TD, TP, corrections et documents de la classe."
        actions={
          canManage ? (
            <AddResourceButton
              modules={moduleOptions}
              semesters={semesterOptions}
              defaultSemesterId={defaultSemesterId}
              autoOpen={raw.nouveau === '1'}
            />
          ) : null
        }
      />

      <FilterBar action="/ressources" hasFilters={hasFilters}>
        <FilterField label="Recherche" htmlFor="q" className="min-w-[200px] flex-[2]">
          <Input
            id="q"
            name="q"
            defaultValue={filters.q ?? ''}
            placeholder="Titre, description, fichier..."
          />
        </FilterField>

        <FilterField label="Module" htmlFor="moduleId">
          <Select id="moduleId" name="moduleId" defaultValue={filters.moduleId ?? ''}>
            <option value="">Tous</option>
            {modules.map((m) => (
              <option key={m.id} value={m.id}>
                {m.code}
              </option>
            ))}
          </Select>
        </FilterField>

        <FilterField label="Type" htmlFor="kind">
          <Select id="kind" name="kind" defaultValue={filters.kind ?? ''}>
            <option value="">Tous</option>
            {Object.entries(RESOURCE_KIND_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </FilterField>

        <FilterField label="Semestre" htmlFor="semesterId">
          <Select id="semesterId" name="semesterId" defaultValue={filters.semesterId ?? ''}>
            <option value="">Tous</option>
            {semesters.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label} — {s.academicYear.label}
              </option>
            ))}
          </Select>
        </FilterField>

        {canManage ? (
          <FilterField label="Archives" htmlFor="archives" className="min-w-[120px]">
            <Select id="archives" name="archives" defaultValue={includeArchived ? '1' : ''}>
              <option value="">Masquées</option>
              <option value="1">Incluses</option>
            </Select>
          </FilterField>
        ) : null}
      </FilterBar>

      <Card>
        {result.items.length === 0 ? (
          <EmptyState
            icon={<IconFolder />}
            title={hasFilters ? 'Aucun résultat' : 'Aucune ressource'}
            description={
              hasFilters
                ? 'Aucune ressource ne correspond à ces filtres.'
                : canManage
                  ? 'Déposez le premier document de la classe.'
                  : 'Les documents déposés par le délégué apparaîtront ici.'
            }
          />
        ) : (
          <>
            <div className="p-3.5 space-y-2.5">
              {result.items.map((resource) => (
                <ResourceItem
                  key={resource.id}
                  resource={resource}
                  actions={
                    canManage ? (
                      <ResourceActions
                        resource={{
                          id: resource.id,
                          title: resource.title,
                          description: resource.description,
                          kind: resource.kind,
                          moduleId: resource.moduleId,
                        }}
                        isArchived={resource.isArchived}
                        modules={moduleOptions}
                        semesters={semesterOptions}
                        defaultSemesterId={defaultSemesterId}
                      />
                    ) : null
                  }
                />
              ))}
            </div>
            <Pagination
              page={result.page}
              pageCount={result.pageCount}
              total={result.total}
              basePath="/ressources"
              params={{
                q: filters.q,
                moduleId: filters.moduleId,
                kind: filters.kind,
                semesterId: filters.semesterId,
                archives: includeArchived ? '1' : undefined,
              }}
            />
          </>
        )}
      </Card>
    </>
  )
}
