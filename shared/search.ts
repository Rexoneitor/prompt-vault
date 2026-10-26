import { normalize, normalizeWithMap } from './text'
import type { Category, Id, Project, Prompt, Tag, Tool } from './types'

/**
 * Búsqueda en memoria: sin acentos ni mayúsculas, por tokens (todos deben aparecer)
 * y con pesos por campo. A escala personal (miles de prompts) responde al instante mientras se escribe.
 */

export interface SearchContext {
  categories: ReadonlyMap<Id, Category>
  projects: ReadonlyMap<Id, Project>
  tools: ReadonlyMap<Id, Tool>
  tags: ReadonlyMap<Id, Tag>
}

interface IndexEntry {
  title: string
  description: string
  content: string
  notes: string
  category: string
  project: string
  tool: string
  tags: string[]
}

export type SearchIndex = ReadonlyMap<Id, IndexEntry>

export function buildSearchIndex(prompts: readonly Prompt[], context: SearchContext): SearchIndex {
  const index = new Map<Id, IndexEntry>()
  for (const prompt of prompts) {
    index.set(prompt.id, {
      title: normalize(prompt.title),
      description: normalize(prompt.description),
      content: normalize(prompt.content),
      notes: normalize(prompt.notes),
      category: normalize(prompt.categoryId ? (context.categories.get(prompt.categoryId)?.name ?? '') : ''),
      project: normalize(prompt.projectId ? (context.projects.get(prompt.projectId)?.name ?? '') : ''),
      tool: normalize(context.tools.get(prompt.toolId)?.name ?? ''),
      tags: prompt.tagIds.map((id) => normalize(context.tags.get(id)?.name ?? '')),
    })
  }
  return index
}

export function tokenize(query: string): string[] {
  return normalize(query)
    .split(/\s+/)
    .filter((token) => token.length > 0)
}

function startsWord(text: string, token: string): boolean {
  let from = 0
  for (;;) {
    const at = text.indexOf(token, from)
    if (at === -1) return false
    if (at === 0 || !/[\p{L}\p{N}]/u.test(text[at - 1])) return true
    from = at + 1
  }
}

function scoreToken(entry: IndexEntry, token: string): number {
  let score = 0
  if (entry.title.includes(token)) {
    score += 12
    if (entry.title.startsWith(token)) score += 6
    else if (startsWord(entry.title, token)) score += 3
  }
  for (const tag of entry.tags) {
    if (tag.includes(token)) {
      score += tag === token ? 12 : 8
      break
    }
  }
  if (entry.category.includes(token)) score += 5
  if (entry.project.includes(token)) score += 5
  if (entry.tool.includes(token)) score += 5
  if (entry.description.includes(token)) score += 4
  if (entry.content.includes(token)) score += 1.5
  if (entry.notes.includes(token)) score += 1
  return score
}

export interface SearchHit {
  id: Id
  score: number
}

/** Todos los tokens deben coincidir en algún campo. Resultado ordenado por relevancia. */
export function searchPrompts(index: SearchIndex, query: string): SearchHit[] {
  const tokens = tokenize(query)
  if (tokens.length === 0) return []
  const hits: SearchHit[] = []
  for (const [id, entry] of index) {
    let total = 0
    let matchesAll = true
    for (const token of tokens) {
      const score = scoreToken(entry, token)
      if (score === 0) {
        matchesAll = false
        break
      }
      total += score
    }
    if (matchesAll) hits.push({ id, score: total })
  }
  return hits.sort((a, b) => b.score - a.score)
}

export interface TextRange {
  start: number
  end: number
}

/** Rangos del texto ORIGINAL que coinciden con algún token (fusionados y ordenados). */
export function findMatchRanges(text: string, tokens: readonly string[]): TextRange[] {
  if (tokens.length === 0 || text.length === 0) return []
  const { normalized, map } = normalizeWithMap(text)
  const ranges: TextRange[] = []
  for (const token of tokens) {
    let from = 0
    for (;;) {
      const at = normalized.indexOf(token, from)
      if (at === -1) break
      const lastIndex = map[at + token.length - 1]
      const end = lastIndex + String.fromCodePoint(text.codePointAt(lastIndex) ?? 0).length
      ranges.push({ start: map[at], end })
      from = at + token.length
    }
  }
  ranges.sort((a, b) => a.start - b.start)
  const merged: TextRange[] = []
  for (const range of ranges) {
    const last = merged[merged.length - 1]
    if (last && range.start <= last.end) last.end = Math.max(last.end, range.end)
    else merged.push({ ...range })
  }
  return merged
}

export interface Snippet {
  text: string
  ranges: TextRange[]
}

/** Fragmento del contenido alrededor de la primera coincidencia, para mostrar «por qué» salió el resultado. */
export function makeSnippet(content: string, tokens: readonly string[], radius = 70): Snippet | null {
  const ranges = findMatchRanges(content, tokens)
  if (ranges.length === 0) return null
  const first = ranges[0]
  const start = Math.max(0, first.start - radius)
  const end = Math.min(content.length, first.end + radius)
  const prefix = start > 0 ? '…' : ''
  const suffix = end < content.length ? '…' : ''
  const raw = content.slice(start, end)
  const flat = raw.replace(/\s+/g, ' ')
  // Los rangos se recalculan sobre el fragmento ya aplanado para que coincidan con lo mostrado.
  const text = `${prefix}${flat}${suffix}`
  return { text, ranges: findMatchRanges(text, tokens) }
}
