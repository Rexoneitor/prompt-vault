import type { ExportFile, ExportFormat } from '../types'
import { toCsv } from './csv'

/** Prompt con las referencias ya resueltas a nombres, listo para formatos legibles. */
export interface ResolvedPrompt {
  id: string
  title: string
  description: string
  content: string
  notes: string
  category: string | null
  project: string | null
  tool: string
  tags: string[]
  favorite: boolean
  archived: boolean
  usageCount: number
  createdAt: string
  updatedAt: string
  lastUsedAt: string | null
}

const MIME: Record<ExportFormat, string> = {
  json: 'application/json',
  csv: 'text/csv',
  markdown: 'text/markdown',
  txt: 'text/plain',
}

const EXTENSION: Record<ExportFormat, string> = { json: 'json', csv: 'csv', markdown: 'md', txt: 'txt' }

export function dateStamp(date: Date): string {
  return date.toISOString().slice(0, 10)
}

export function exportFilename(kind: 'backup' | 'export', format: ExportFormat, date: Date): string {
  return `prompt-vault-${kind}-${dateStamp(date)}.${EXTENSION[format]}`
}

export function makeExportFile(kind: 'backup' | 'export', format: ExportFormat, content: string, count: number, date: Date): ExportFile {
  return { filename: exportFilename(kind, format, date), mimeType: `${MIME[format]};charset=utf-8`, content, count }
}

export const CSV_COLUMNS = [
  'title',
  'description',
  'prompt',
  'category',
  'project',
  'tool',
  'tags',
  'favorite',
  'archived',
  'usage_count',
  'notes',
  'created_at',
  'updated_at',
  'last_used_at',
] as const

export function promptsToCsv(prompts: readonly ResolvedPrompt[]): string {
  const rows: string[][] = [[...CSV_COLUMNS]]
  for (const p of prompts) {
    rows.push([
      p.title,
      p.description,
      p.content,
      p.category ?? '',
      p.project ?? '',
      p.tool,
      p.tags.join('; '),
      p.favorite ? 'yes' : 'no',
      p.archived ? 'yes' : 'no',
      String(p.usageCount),
      p.notes,
      p.createdAt,
      p.updatedAt,
      p.lastUsedAt ?? '',
    ])
  }
  return toCsv(rows)
}

/** Fence más larga que cualquier racha de backticks del contenido, para que el bloque no se rompa. */
function fenceFor(content: string): string {
  const longest = Math.max(0, ...(content.match(/`+/g) ?? []).map((run) => run.length))
  return '`'.repeat(Math.max(3, longest + 1))
}

export function promptsToMarkdown(prompts: readonly ResolvedPrompt[], exportedAt: Date): string {
  const lines: string[] = [
    '# Prompt Vault — Exportación',
    '',
    `_Exportado el ${dateStamp(exportedAt)} · ${prompts.length} prompt${prompts.length === 1 ? '' : 's'}_`,
  ]
  for (const p of prompts) {
    lines.push('', '---', '', `## ${p.title.replace(/\s+/g, ' ')}`, '')
    const meta: [string, string][] = [
      ['Descripción', p.description.replace(/\s+/g, ' ')],
      ['Categoría', p.category ?? ''],
      ['Proyecto', p.project ?? ''],
      ['Herramienta', p.tool],
      ['Etiquetas', p.tags.join(', ')],
      ['Favorito', p.favorite ? 'sí' : ''],
    ]
    for (const [key, value] of meta) if (value) lines.push(`- **${key}:** ${value}`)
    const fence = fenceFor(p.content)
    lines.push('', `${fence}text`, p.content, fence)
    if (p.notes) {
      lines.push('')
      p.notes.split('\n').forEach((line, i) => lines.push(i === 0 ? `> **Notas:** ${line}` : `> ${line}`))
    }
  }
  return `${lines.join('\n')}\n`
}

export function promptsToText(prompts: readonly ResolvedPrompt[], exportedAt: Date): string {
  const rule = '='.repeat(72)
  const thin = '-'.repeat(72)
  const out: string[] = [
    `PROMPT VAULT — Exportación (${dateStamp(exportedAt)} · ${prompts.length} prompt${prompts.length === 1 ? '' : 's'})`,
  ]
  for (const p of prompts) {
    out.push('', rule, p.title.toUpperCase())
    const facts = [
      p.category && `Categoría: ${p.category}`,
      p.project && `Proyecto: ${p.project}`,
      `Herramienta: ${p.tool}`,
      p.tags.length > 0 && `Etiquetas: ${p.tags.join(', ')}`,
    ].filter(Boolean)
    out.push(facts.join(' | '))
    if (p.description) out.push(p.description)
    out.push(thin, p.content)
    if (p.notes) out.push('', `Notas: ${p.notes}`)
  }
  return `${out.join('\n')}\n`
}
