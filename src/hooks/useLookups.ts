import { useMemo } from 'react'
import { useLibrary } from '@/store/library'
import { buildSearchIndex, type SearchContext, type SearchIndex } from '@shared/search'

/** Tablas id → entidad, recalculadas solo cuando cambian los datos. */
export function useLookups(): SearchContext {
  const categories = useLibrary((s) => s.categories)
  const projects = useLibrary((s) => s.projects)
  const tools = useLibrary((s) => s.tools)
  const tags = useLibrary((s) => s.tags)
  return useMemo(
    () => ({
      categories: new Map(categories.map((c) => [c.id, c])),
      projects: new Map(projects.map((p) => [p.id, p])),
      tools: new Map(tools.map((t) => [t.id, t])),
      tags: new Map(tags.map((t) => [t.id, t])),
    }),
    [categories, projects, tools, tags],
  )
}

/** Índice de búsqueda en memoria: se reconstruye solo si cambian prompts o taxonomía. */
export function useSearchIndex(): SearchIndex {
  const prompts = useLibrary((s) => s.prompts)
  const lookups = useLookups()
  return useMemo(() => buildSearchIndex(prompts, lookups), [prompts, lookups])
}
