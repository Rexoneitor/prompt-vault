import { VaultError } from './errors'
import { collapseSpaces, deriveTitle, nameKey } from './text'
import { GENERAL_TOOL_ID, type PromptDraft } from './types'

export const LIMITS = {
  title: 200,
  description: 2_000,
  content: 200_000,
  notes: 20_000,
  name: 80,
  tagName: 40,
  tagsPerPrompt: 30,
} as const

function tooLong(label: string, max: number): never {
  throw new VaultError('VALIDATION', `${label} supera el máximo de ${max.toLocaleString('es')} caracteres.`)
}

/** Valida y limpia un nombre de categoría, proyecto, herramienta o etiqueta. */
export function cleanName(raw: unknown, label: string, max: number = LIMITS.name): string {
  const name = typeof raw === 'string' ? collapseSpaces(raw) : ''
  if (!name) throw new VaultError('VALIDATION', `${label} no puede estar vacío.`)
  if (name.length > max) tooLong(label, max)
  return name
}

/** Etiquetas limpias, únicas (sin distinguir acentos/mayúsculas) y sin `#` inicial. */
export function cleanTags(raw: readonly string[]): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  for (const item of raw) {
    const tag = collapseSpaces(String(item).replace(/^#+/, ''))
    if (!tag) continue
    if (tag.length > LIMITS.tagName) tooLong('Una etiqueta', LIMITS.tagName)
    const key = nameKey(tag)
    if (seen.has(key)) continue
    seen.add(key)
    result.push(tag)
  }
  if (result.length > LIMITS.tagsPerPrompt) {
    throw new VaultError('VALIDATION', `Un prompt admite hasta ${LIMITS.tagsPerPrompt} etiquetas.`)
  }
  return result
}

/** Normaliza el borrador de un prompt. El contenido es obligatorio; el título se deriva si falta. */
export function normalizeDraft(draft: PromptDraft): PromptDraft {
  const content = typeof draft.content === 'string' ? draft.content.replace(/\r\n/g, '\n') : ''
  if (content.trim().length === 0) {
    throw new VaultError('VALIDATION', 'El prompt está vacío: escribe su contenido antes de guardar.')
  }
  if (content.length > LIMITS.content) tooLong('El prompt', LIMITS.content)

  const title = collapseSpaces(draft.title ?? '') || deriveTitle(content)
  if (title.length > LIMITS.title) tooLong('El título', LIMITS.title)

  const description = (draft.description ?? '').trim()
  if (description.length > LIMITS.description) tooLong('La descripción', LIMITS.description)

  const notes = (draft.notes ?? '').trim()
  if (notes.length > LIMITS.notes) tooLong('Las notas', LIMITS.notes)

  return {
    title,
    description,
    content,
    notes,
    categoryId: draft.categoryId || null,
    projectId: draft.projectId || null,
    toolId: draft.toolId || GENERAL_TOOL_ID,
    tags: cleanTags(draft.tags ?? []),
    favorite: Boolean(draft.favorite),
  }
}
