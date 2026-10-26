import { VaultError } from '../errors'
import { deriveTitle, normalize } from '../text'
import type { ImportDraft, ImportInput, ImportSource, ImportVersionDraft } from '../types'
import { LIMITS } from '../validation'
import { BACKUP_APP, parseBackup } from './backup'
import { parseCsv } from './csv'

export interface ParsedImport {
  source: ImportSource
  drafts: ImportDraft[]
  /** Elementos sin contenido que se descartaron. */
  skipped: number
  warnings: string[]
}

/* ------------------------------- utilidades comunes ------------------------------- */

const KEYS = {
  content: ['content', 'prompt', 'contenido', 'texto', 'text', 'body'],
  title: ['title', 'titulo', 'name', 'nombre'],
  description: ['description', 'descripcion', 'resumen', 'summary'],
  notes: ['notes', 'notas', 'note', 'nota'],
  category: ['category', 'categoria'],
  project: ['project', 'proyecto'],
  tool: ['tool', 'herramienta', 'model', 'modelo', 'ia'],
  tags: ['tags', 'etiquetas', 'tag', 'etiqueta', 'labels'],
  favorite: ['favorite', 'favorito', 'favourite', 'starred'],
} as const

type FieldGetter = (keys: readonly string[]) => unknown

function text(value: unknown): string {
  if (typeof value === 'string') return value
  if (typeof value === 'number') return String(value)
  return ''
}

function optionalName(value: unknown): string | null {
  const name = text(value).replace(/\s+/g, ' ').trim()
  return name.length > 0 ? name.slice(0, LIMITS.name) : null
}

function parseTags(value: unknown): string[] {
  const items = Array.isArray(value) ? value.map(text) : text(value).split(/[,;|]/)
  const seen = new Set<string>()
  const tags: string[] = []
  for (const item of items) {
    const tag = item.replace(/^#+/, '').replace(/\s+/g, ' ').trim().slice(0, LIMITS.tagName)
    const key = normalize(tag)
    if (tag && !seen.has(key)) {
      seen.add(key)
      tags.push(tag)
    }
  }
  return tags.slice(0, LIMITS.tagsPerPrompt)
}

function truthy(value: unknown): boolean {
  if (value === true) return true
  return ['yes', 'si', 'true', '1', 'x', '★'].includes(normalize(text(value)).trim())
}

function makeDraft(partial: Partial<ImportDraft> & { content: string }): ImportDraft {
  const content = partial.content.replace(/\r\n/g, '\n').trim()
  return {
    title: (partial.title ?? '').replace(/\s+/g, ' ').trim() || deriveTitle(content),
    description: (partial.description ?? '').trim(),
    content,
    notes: (partial.notes ?? '').trim(),
    categoryName: partial.categoryName ?? null,
    projectName: partial.projectName ?? null,
    toolName: partial.toolName ?? null,
    tags: partial.tags ?? [],
    favorite: partial.favorite ?? false,
    versions: partial.versions ?? [],
  }
}

/** Convierte una fila/objeto en borrador usando alias de campos (español e inglés). */
function draftFromFields(get: FieldGetter): ImportDraft | null {
  const content = text(get(KEYS.content))
  if (content.trim().length === 0) return null
  return makeDraft({
    content,
    title: text(get(KEYS.title)),
    description: text(get(KEYS.description)),
    notes: text(get(KEYS.notes)),
    categoryName: optionalName(get(KEYS.category)),
    projectName: optionalName(get(KEYS.project)),
    toolName: optionalName(get(KEYS.tool)),
    tags: parseTags(get(KEYS.tags)),
    favorite: truthy(get(KEYS.favorite)),
  })
}

function invalid(message: string): never {
  throw new VaultError('IMPORT_INVALID', message)
}

/* ----------------------------------- JSON ----------------------------------- */

function parseJsonImport(content: string): ParsedImport {
  let raw: unknown
  try {
    raw = JSON.parse(content.replace(/^﻿/, ''))
  } catch {
    invalid('El archivo no es un JSON válido.')
  }

  // Formato propio: se resuelven los ids a nombres para fusionar con la biblioteca actual.
  if (typeof raw === 'object' && raw !== null && (raw as { app?: unknown }).app === BACKUP_APP) {
    let parsed
    try {
      parsed = parseBackup(content)
    } catch (error) {
      invalid(error instanceof Error ? error.message : 'Backup inválido.')
    }
    const { backup, warnings } = parsed
    const categories = new Map(backup.categories.map((c) => [c.id, c.name]))
    const projects = new Map(backup.projects.map((p) => [p.id, p.name]))
    const tools = new Map(backup.tools.map((t) => [t.id, t.name]))
    const drafts = backup.prompts.map((p) =>
      makeDraft({
        title: p.title,
        description: p.description,
        content: p.content,
        notes: p.notes,
        categoryName: p.categoryId ? (categories.get(p.categoryId) ?? null) : null,
        projectName: p.projectId ? (projects.get(p.projectId) ?? null) : null,
        toolName: tools.get(p.toolId) ?? null,
        tags: p.tags,
        favorite: p.favorite,
        versions: p.versions.map((v): ImportVersionDraft => ({ name: v.name, content: v.content, notes: v.notes, createdAt: v.createdAt })),
      }),
    )
    return { source: 'json', drafts, skipped: 0, warnings }
  }

  const list = Array.isArray(raw)
    ? raw
    : Array.isArray((raw as { prompts?: unknown })?.prompts)
      ? (raw as { prompts: unknown[] }).prompts
      : null
  if (!list)
    invalid('No encuentro una lista de prompts en el JSON. Usa un backup de Prompt Vault o una lista de objetos con «title» y «content».')

  const drafts: ImportDraft[] = []
  let skipped = 0
  for (const item of list) {
    let draft: ImportDraft | null = null
    if (typeof item === 'string') {
      draft = item.trim() ? makeDraft({ content: item }) : null
    } else if (typeof item === 'object' && item !== null) {
      const fields = new Map(Object.entries(item as Record<string, unknown>).map(([k, v]) => [normalize(k).trim(), v]))
      draft = draftFromFields((keys) => keys.map((k) => fields.get(k)).find((v) => v !== undefined && v !== null && v !== ''))
    }
    if (draft) drafts.push(draft)
    else skipped++
  }
  return { source: 'json', drafts, skipped, warnings: [] }
}

/* ----------------------------------- CSV ----------------------------------- */

function parseCsvImport(content: string): ParsedImport {
  const rows = parseCsv(content)
  if (rows.length === 0) invalid('El CSV está vacío.')

  const header = rows[0].map((cell) => normalize(cell).trim())
  const hasContentColumn = header.some((cell) => (KEYS.content as readonly string[]).includes(cell))

  const drafts: ImportDraft[] = []
  let skipped = 0

  if (!hasContentColumn) {
    // Una sola columna sin cabecera reconocible: cada fila es un prompt.
    if (rows.every((row) => row.length === 1)) {
      for (const [cell] of rows) {
        if (cell.trim()) drafts.push(makeDraft({ content: cell }))
        else skipped++
      }
      return { source: 'csv', drafts, skipped, warnings: [] }
    }
    invalid(
      'No encuentro la columna con el texto del prompt. Añade una cabecera llamada «prompt» o «contenido» (y opcionalmente title, description, category, tags, project, tool).',
    )
  }

  for (const row of rows.slice(1)) {
    const draft = draftFromFields((keys) => {
      for (const key of keys) {
        const at = header.indexOf(key)
        if (at !== -1 && row[at] !== undefined && row[at] !== '') return row[at]
      }
      return undefined
    })
    if (draft) drafts.push(draft)
    else skipped++
  }
  return { source: 'csv', drafts, skipped, warnings: [] }
}

/* --------------------------------- Markdown --------------------------------- */

interface Fence {
  char: string
  length: number
}

function openFence(line: string): Fence | null {
  const match = /^\s{0,3}(`{3,}|~{3,})/.exec(line)
  return match ? { char: match[1][0], length: match[1].length } : null
}

function closesFence(line: string, fence: Fence): boolean {
  const trimmed = line.trim()
  return trimmed.length >= fence.length && trimmed === fence.char.repeat(trimmed.length)
}

/** Marca qué líneas pertenecen a un bloque de código (incluidas las vallas). */
function fenceMask(lines: readonly string[]): boolean[] {
  const mask = new Array<boolean>(lines.length).fill(false)
  let open: Fence | null = null
  lines.forEach((line, index) => {
    if (open) {
      mask[index] = true
      if (closesFence(line, open)) open = null
      return
    }
    open = openFence(line)
    if (open) mask[index] = true
  })
  return mask
}

const META_LINE = /^\s*-\s+\*\*([^*:]+?):?\*\*:?\s*(.*)$/

function applyMeta(draft: Partial<ImportDraft>, rawKey: string, value: string): void {
  const key = normalize(rawKey).trim()
  const is = (aliases: readonly string[]) => aliases.includes(key)
  if (is(KEYS.description)) draft.description = value
  else if (is(KEYS.category)) draft.categoryName = optionalName(value)
  else if (is(KEYS.project)) draft.projectName = optionalName(value)
  else if (is(KEYS.tool)) draft.toolName = optionalName(value)
  else if (is(KEYS.tags)) draft.tags = parseTags(value)
  else if (is(KEYS.favorite)) draft.favorite = truthy(value)
}

/**
 * Una sección «## Título»: viñetas de metadatos, luego el prompt (en un bloque de código
 * o como texto libre) y, opcionalmente, notas como cita «>».
 */
function parseSection(title: string, body: readonly string[]): ImportDraft | null {
  const draft: Partial<ImportDraft> = { title }
  let cursor = 0

  for (; cursor < body.length; cursor++) {
    if (body[cursor].trim() === '') continue
    const meta = META_LINE.exec(body[cursor])
    if (!meta) break
    applyMeta(draft, meta[1], meta[2].trim())
  }

  const rest = body.slice(cursor)
  const firstLine = rest.findIndex((line) => line.trim() !== '')
  const fence = firstLine === -1 ? null : openFence(rest[firstLine])

  let content: string
  if (fence) {
    let end = firstLine + 1
    while (end < rest.length && !closesFence(rest[end], fence)) end++
    content = rest.slice(firstLine + 1, end).join('\n')
    const quoted = rest
      .slice(end + 1)
      .filter((line) => line.startsWith('>'))
      .map((line) => line.replace(/^>\s?/, ''))
    if (quoted.length > 0) draft.notes = quoted.join('\n').replace(/^\*\*Notas:\*\*\s*/i, '')
  } else {
    const lines = [...rest]
    while (lines.length > 0 && /^(\s*|-{3,})$/.test(lines[lines.length - 1])) lines.pop()
    content = lines.join('\n')
  }
  return content.trim().length === 0 ? null : makeDraft({ ...draft, content })
}

function parseMarkdownImport(content: string, asSingle: boolean): ParsedImport {
  const lines = content.replace(/\r\n/g, '\n').split('\n')
  const mask = fenceMask(lines)
  const starts = lines.flatMap((line, index) => (!mask[index] && /^##\s+\S/.test(line) ? [index] : []))

  if (asSingle || starts.length === 0) return parseSingleDocument(lines, mask)

  const drafts: ImportDraft[] = []
  let skipped = 0
  starts.forEach((start, i) => {
    const end = starts[i + 1] ?? lines.length
    const title = lines[start].replace(/^##\s+/, '').trim()
    const draft = parseSection(title, lines.slice(start + 1, end))
    if (draft) drafts.push(draft)
    else skipped++
  })
  return { source: 'markdown', drafts, skipped, warnings: [] }
}

function parseSingleDocument(lines: readonly string[], mask: readonly boolean[]): ParsedImport {
  const first = lines.findIndex((line) => line.trim() !== '')
  if (first === -1) invalid('El archivo está vacío.')
  const heading = !mask[first] ? /^#\s+(.+)$/.exec(lines[first]) : null
  const body = (heading ? lines.slice(first + 1) : lines).join('\n')
  const drafts = body.trim() ? [makeDraft({ title: heading?.[1], content: body })] : []
  return { source: 'markdown', drafts, skipped: drafts.length === 0 ? 1 : 0, warnings: [] }
}

/* ---------------------------------- entrada ---------------------------------- */

function extensionOf(filename: string): string {
  const match = /\.([a-z0-9]+)$/i.exec(filename)
  return match ? match[1].toLowerCase() : ''
}

export function parseImport(input: ImportInput): ParsedImport {
  if (input.kind === 'text') {
    if (input.content.trim().length === 0) invalid('No hay texto que importar.')
    return { source: 'text', drafts: [makeDraft({ content: input.content })], skipped: 0, warnings: [] }
  }

  const content = input.content.replace(/^﻿/, '')
  if (content.trim().length === 0) invalid('El archivo está vacío.')

  switch (extensionOf(input.filename)) {
    case 'json':
      return parseJsonImport(content)
    case 'csv':
    case 'tsv':
      return parseCsvImport(content)
    case 'md':
    case 'markdown':
      return parseMarkdownImport(content, input.asSingle === true)
    case 'txt':
      return { source: 'text', drafts: [makeDraft({ content })], skipped: 0, warnings: [] }
    default: {
      const head = content.trimStart()[0]
      if (head === '{' || head === '[') return parseJsonImport(content)
      return parseMarkdownImport(content, input.asSingle === true)
    }
  }
}
