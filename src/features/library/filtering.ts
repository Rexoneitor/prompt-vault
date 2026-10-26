import { searchPrompts, type SearchIndex } from '@shared/search'
import type { Id, Prompt } from '@shared/types'

/** Qué subconjunto de la biblioteca se está viendo (lo decide la ruta). */
export type Scope =
  | { kind: 'all' }
  | { kind: 'favorites' }
  | { kind: 'recent' }
  | { kind: 'archived' }
  | { kind: 'category'; id: Id }
  | { kind: 'project'; id: Id }
  | { kind: 'tag'; id: Id }

export type SortKey = 'modified' | 'used' | 'created' | 'title' | 'most-used'

export const SORT_LABELS: Record<SortKey, string> = {
  modified: 'Última modificación',
  used: 'Último uso',
  created: 'Fecha de creación',
  title: 'Título (A–Z)',
  'most-used': 'Más usados',
}

export interface Filters {
  query: string
  categoryId: Id | null
  projectId: Id | null
  tagId: Id | null
  toolId: Id | null
  favoritesOnly: boolean
}

export const NO_FILTERS: Filters = { query: '', categoryId: null, projectId: null, tagId: null, toolId: null, favoritesOnly: false }

function inScope(prompt: Prompt, scope: Scope): boolean {
  if (scope.kind === 'archived') return prompt.archived
  if (prompt.archived) return false
  switch (scope.kind) {
    case 'favorites':
      return prompt.favorite
    case 'recent':
      return prompt.lastUsedAt !== null
    case 'category':
      return prompt.categoryId === scope.id
    case 'project':
      return prompt.projectId === scope.id
    case 'tag':
      return prompt.tagIds.includes(scope.id)
    default:
      return true
  }
}

function matchesFilters(prompt: Prompt, filters: Filters): boolean {
  return (
    (!filters.categoryId || prompt.categoryId === filters.categoryId) &&
    (!filters.projectId || prompt.projectId === filters.projectId) &&
    (!filters.tagId || prompt.tagIds.includes(filters.tagId)) &&
    (!filters.toolId || prompt.toolId === filters.toolId) &&
    (!filters.favoritesOnly || prompt.favorite)
  )
}

const byDateDesc = (a: string | null, b: string | null) => (b ?? '').localeCompare(a ?? '')

const SORTERS: Record<SortKey, (a: Prompt, b: Prompt) => number> = {
  modified: (a, b) => byDateDesc(a.updatedAt, b.updatedAt),
  used: (a, b) => byDateDesc(a.lastUsedAt ?? a.createdAt, b.lastUsedAt ?? b.createdAt),
  created: (a, b) => byDateDesc(a.createdAt, b.createdAt),
  title: (a, b) => a.title.localeCompare(b.title, 'es', { sensitivity: 'base' }),
  'most-used': (a, b) => b.usageCount - a.usageCount || byDateDesc(a.lastUsedAt, b.lastUsedAt),
}

/**
 * Aplica ámbito, filtros, búsqueda y orden. Con texto de búsqueda manda la relevancia;
 * en «Recientes» manda el último uso.
 */
export function selectPrompts(prompts: readonly Prompt[], scope: Scope, filters: Filters, sort: SortKey, index: SearchIndex): Prompt[] {
  const candidates = prompts.filter((prompt) => inScope(prompt, scope) && matchesFilters(prompt, filters))

  if (filters.query.trim()) {
    const score = new Map(searchPrompts(index, filters.query).map((hit) => [hit.id, hit.score]))
    return candidates.filter((p) => score.has(p.id)).sort((a, b) => score.get(b.id)! - score.get(a.id)! || SORTERS.used(a, b))
  }
  return [...candidates].sort(scope.kind === 'recent' ? SORTERS.used : SORTERS[sort])
}
