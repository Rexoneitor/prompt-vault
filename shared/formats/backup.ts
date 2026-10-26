import { VaultError } from '../errors'
import { DEFAULT_CATEGORY_COLOR, isCategoryColor } from '../palette'
import { nameKey } from '../text'
import { GENERAL_TOOL_ID, type Category, type Project, type Tool } from '../types'
import { cleanTags } from '../validation'

/**
 * Formato de intercambio completo de Prompt Vault (copias de seguridad y exportación JSON).
 * Es la fuente de verdad para restaurar: conserva ids, versiones y estadísticas de uso.
 */

export const BACKUP_APP = 'prompt-vault'
export const BACKUP_FORMAT_VERSION = 1

export interface BackupVersion {
  id: string
  version: number
  name: string | null
  content: string
  notes: string
  createdAt: string
}

export interface BackupPrompt {
  id: string
  title: string
  description: string
  content: string
  notes: string
  categoryId: string | null
  projectId: string | null
  toolId: string
  tags: string[]
  favorite: boolean
  archived: boolean
  isDemo: boolean
  usageCount: number
  createdAt: string
  updatedAt: string
  lastUsedAt: string | null
  versions: BackupVersion[]
}

export interface BackupFile {
  app: typeof BACKUP_APP
  formatVersion: number
  exportedAt: string
  categories: Category[]
  projects: Project[]
  tools: Tool[]
  prompts: BackupPrompt[]
}

export function serializeBackup(backup: BackupFile): string {
  return JSON.stringify(backup, null, 2)
}

/* ----------------------------- lectura defensiva ----------------------------- */

type Rec = Record<string, unknown>

function fail(path: string, problem: string): never {
  throw new VaultError('BACKUP_INVALID', `Backup inválido en «${path}»: ${problem}.`)
}

function asRecord(value: unknown, path: string): Rec {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) fail(path, 'se esperaba un objeto')
  return value as Rec
}

function asArray(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value)) fail(path, 'se esperaba una lista')
  return value
}

function reqString(rec: Rec, key: string, path: string): string {
  const value = rec[key]
  if (typeof value !== 'string' || value.length === 0) fail(`${path}.${key}`, 'falta o está vacío')
  return value
}

function optString(rec: Rec, key: string, path: string): string {
  const value = rec[key]
  if (value === undefined || value === null) return ''
  if (typeof value !== 'string') fail(`${path}.${key}`, 'debe ser texto')
  return value
}

function optNullableString(rec: Rec, key: string): string | null {
  const value = rec[key]
  return typeof value === 'string' && value.length > 0 ? value : null
}

function optBool(rec: Rec, key: string): boolean {
  return rec[key] === true
}

function optInt(rec: Rec, key: string, fallback: number): number {
  const value = rec[key]
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.floor(value) : fallback
}

function optDate(rec: Rec, key: string, fallback: string): string {
  const value = rec[key]
  return typeof value === 'string' && !Number.isNaN(Date.parse(value)) ? value : fallback
}

function ensureUnique<T>(items: readonly T[], keyOf: (item: T) => string, path: string, what: string): void {
  const seen = new Set<string>()
  for (const item of items) {
    const key = keyOf(item)
    if (seen.has(key)) fail(path, `${what} duplicado «${key}»`)
    seen.add(key)
  }
}

export interface ParsedBackup {
  backup: BackupFile
  warnings: string[]
}

/** Parsea y valida un backup. Cualquier problema estructural lanza `BACKUP_INVALID` sin tocar datos. */
export function parseBackup(text: string): ParsedBackup {
  let raw: unknown
  try {
    raw = JSON.parse(text.replace(/^﻿/, ''))
  } catch {
    throw new VaultError('BACKUP_INVALID', 'El archivo no es un JSON válido (¿está dañado o incompleto?).')
  }
  const root = asRecord(raw, 'raíz')
  if (root.app !== BACKUP_APP) {
    throw new VaultError('BACKUP_INVALID', 'Este archivo no es un backup de Prompt Vault.')
  }
  if (typeof root.formatVersion !== 'number' || root.formatVersion > BACKUP_FORMAT_VERSION) {
    throw new VaultError(
      'BACKUP_INVALID',
      'El backup fue creado con una versión más nueva de Prompt Vault. Actualiza la aplicación para poder leerlo.',
    )
  }

  const warnings: string[] = []
  const now = new Date().toISOString()
  const exportedAt = optDate(root, 'exportedAt', now)

  const categories: Category[] = asArray(root.categories ?? [], 'categories').map((item, index) => {
    const path = `categories[${index}]`
    const rec = asRecord(item, path)
    const color = optString(rec, 'color', path)
    return {
      id: reqString(rec, 'id', path),
      name: reqString(rec, 'name', path),
      color: isCategoryColor(color) ? color : DEFAULT_CATEGORY_COLOR,
      sortOrder: optInt(rec, 'sortOrder', index),
      createdAt: optDate(rec, 'createdAt', exportedAt),
      updatedAt: optDate(rec, 'updatedAt', exportedAt),
    }
  })
  ensureUnique(categories, (c) => c.id, 'categories', 'id')
  ensureUnique(categories, (c) => nameKey(c.name), 'categories', 'nombre')

  const projects: Project[] = asArray(root.projects ?? [], 'projects').map((item, index) => {
    const path = `projects[${index}]`
    const rec = asRecord(item, path)
    return {
      id: reqString(rec, 'id', path),
      name: reqString(rec, 'name', path),
      description: optString(rec, 'description', path),
      isDemo: optBool(rec, 'isDemo'),
      createdAt: optDate(rec, 'createdAt', exportedAt),
      updatedAt: optDate(rec, 'updatedAt', exportedAt),
    }
  })
  ensureUnique(projects, (p) => p.id, 'projects', 'id')
  ensureUnique(projects, (p) => nameKey(p.name), 'projects', 'nombre')

  const tools: Tool[] = asArray(root.tools ?? [], 'tools').map((item, index) => {
    const path = `tools[${index}]`
    const rec = asRecord(item, path)
    return {
      id: reqString(rec, 'id', path),
      name: reqString(rec, 'name', path),
      sortOrder: optInt(rec, 'sortOrder', index),
    }
  })
  ensureUnique(tools, (t) => t.id, 'tools', 'id')
  ensureUnique(tools, (t) => nameKey(t.name), 'tools', 'nombre')

  const categoryIds = new Set(categories.map((c) => c.id))
  const projectIds = new Set(projects.map((p) => p.id))
  const toolIds = new Set(tools.map((t) => t.id))
  toolIds.add(GENERAL_TOOL_ID)
  let danglingReferences = 0

  const prompts: BackupPrompt[] = asArray(root.prompts ?? [], 'prompts').map((item, index) => {
    const path = `prompts[${index}]`
    const rec = asRecord(item, path)
    const content = reqString(rec, 'content', path)
    const createdAt = optDate(rec, 'createdAt', exportedAt)

    let categoryId = optNullableString(rec, 'categoryId')
    if (categoryId && !categoryIds.has(categoryId)) {
      categoryId = null
      danglingReferences++
    }
    let projectId = optNullableString(rec, 'projectId')
    if (projectId && !projectIds.has(projectId)) {
      projectId = null
      danglingReferences++
    }
    let toolId = optNullableString(rec, 'toolId') ?? GENERAL_TOOL_ID
    if (!toolIds.has(toolId)) {
      toolId = GENERAL_TOOL_ID
      danglingReferences++
    }

    const rawTags = rec.tags === undefined ? [] : asArray(rec.tags, `${path}.tags`)
    const tags = cleanTags(rawTags.filter((tag): tag is string => typeof tag === 'string'))

    const versions: BackupVersion[] = asArray(rec.versions ?? [], `${path}.versions`).map((v, vIndex) => {
      const vPath = `${path}.versions[${vIndex}]`
      const vRec = asRecord(v, vPath)
      return {
        id: reqString(vRec, 'id', vPath),
        version: optInt(vRec, 'version', vIndex + 1),
        name: optNullableString(vRec, 'name'),
        content: reqString(vRec, 'content', vPath),
        notes: optString(vRec, 'notes', vPath),
        createdAt: optDate(vRec, 'createdAt', createdAt),
      }
    })
    ensureUnique(versions, (v) => String(v.version), `${path}.versions`, 'número de versión')

    return {
      id: reqString(rec, 'id', path),
      title: optString(rec, 'title', path).trim() || 'Prompt sin título',
      description: optString(rec, 'description', path),
      content,
      notes: optString(rec, 'notes', path),
      categoryId,
      projectId,
      toolId,
      tags,
      favorite: optBool(rec, 'favorite'),
      archived: optBool(rec, 'archived'),
      isDemo: optBool(rec, 'isDemo'),
      usageCount: optInt(rec, 'usageCount', 0),
      createdAt,
      updatedAt: optDate(rec, 'updatedAt', createdAt),
      lastUsedAt: optDate(rec, 'lastUsedAt', '') || null,
      versions,
    }
  })
  ensureUnique(prompts, (p) => p.id, 'prompts', 'id')
  ensureUnique(
    prompts.flatMap((p) => p.versions),
    (v) => v.id,
    'prompts[].versions',
    'id de versión',
  )

  if (danglingReferences > 0) {
    warnings.push(`${danglingReferences} referencia(s) a categorías, proyectos o herramientas inexistentes se dejaron sin asignar.`)
  }

  return {
    backup: { app: BACKUP_APP, formatVersion: root.formatVersion, exportedAt, categories, projects, tools, prompts },
    warnings,
  }
}
