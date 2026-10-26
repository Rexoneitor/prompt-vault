import { VaultError } from '@shared/errors'
import type { Id, Prompt, PromptVersion } from '@shared/types'
import { all, flag, one, placeholders, run, type Db } from '../db'

interface PromptRow {
  id: Id
  title: string
  description: string
  content: string
  notes: string
  category_id: Id | null
  project_id: Id | null
  tool_id: Id
  favorite: number
  archived: number
  is_demo: number
  usage_count: number
  version_count: number
  created_at: string
  updated_at: string
  last_used_at: string | null
}

const SELECT_PROMPT = `
  SELECT p.*, (SELECT COUNT(*) FROM prompt_versions v WHERE v.prompt_id = p.id) AS version_count
  FROM prompts p`

function toPrompt(row: PromptRow, tagIds: Id[]): Prompt {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    content: row.content,
    notes: row.notes,
    categoryId: row.category_id,
    projectId: row.project_id,
    toolId: row.tool_id,
    tagIds,
    favorite: row.favorite === 1,
    archived: row.archived === 1,
    isDemo: row.is_demo === 1,
    usageCount: row.usage_count,
    versionCount: row.version_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastUsedAt: row.last_used_at,
  }
}

/** Datos persistidos de un prompt (sin lo derivado: etiquetas y nº de versiones). */
export type PromptRecord = Omit<Prompt, 'tagIds' | 'versionCount'>

export interface PromptEdit {
  title: string
  description: string
  content: string
  notes: string
  categoryId: Id | null
  projectId: Id | null
  toolId: Id
  favorite: boolean
}

export class PromptRepo {
  constructor(private readonly db: Db) {}

  list(): Prompt[] {
    const tagsByPrompt = new Map<Id, Id[]>()
    for (const row of all<{ prompt_id: Id; tag_id: Id }>(this.db, 'SELECT prompt_id, tag_id FROM prompt_tags')) {
      const list = tagsByPrompt.get(row.prompt_id)
      if (list) list.push(row.tag_id)
      else tagsByPrompt.set(row.prompt_id, [row.tag_id])
    }
    return all<PromptRow>(this.db, `${SELECT_PROMPT} ORDER BY p.created_at`).map((row) => toPrompt(row, tagsByPrompt.get(row.id) ?? []))
  }

  find(id: Id): Prompt | null {
    const row = one<PromptRow>(this.db, `${SELECT_PROMPT} WHERE p.id = ?`, id)
    if (!row) return null
    const tagIds = all<{ tag_id: Id }>(this.db, 'SELECT tag_id FROM prompt_tags WHERE prompt_id = ?', id).map((r) => r.tag_id)
    return toPrompt(row, tagIds)
  }

  get(id: Id): Prompt {
    const prompt = this.find(id)
    if (!prompt) throw new VaultError('NOT_FOUND', 'El prompt no existe (puede haberse eliminado).')
    return prompt
  }

  many(ids: readonly Id[]): Prompt[] {
    return ids.map((id) => this.find(id)).filter((p): p is Prompt => p !== null)
  }

  insert(record: PromptRecord): void {
    run(
      this.db,
      `INSERT INTO prompts (id, title, description, content, notes, category_id, project_id, tool_id,
         favorite, archived, is_demo, usage_count, created_at, updated_at, last_used_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      record.id,
      record.title,
      record.description,
      record.content,
      record.notes,
      record.categoryId,
      record.projectId,
      record.toolId,
      flag(record.favorite),
      flag(record.archived),
      flag(record.isDemo),
      record.usageCount,
      record.createdAt,
      record.updatedAt,
      record.lastUsedAt,
    )
  }

  /** Editar un prompt lo «adopta»: deja de contarse como dato de demostración. */
  update(id: Id, edit: PromptEdit, updatedAt: string): void {
    run(
      this.db,
      `UPDATE prompts SET title = ?, description = ?, content = ?, notes = ?, category_id = ?, project_id = ?,
         tool_id = ?, favorite = ?, is_demo = 0, updated_at = ?, last_used_at = ? WHERE id = ?`,
      edit.title,
      edit.description,
      edit.content,
      edit.notes,
      edit.categoryId,
      edit.projectId,
      edit.toolId,
      flag(edit.favorite),
      updatedAt,
      updatedAt,
      id,
    )
  }

  setFavorite(id: Id, favorite: boolean): void {
    run(this.db, 'UPDATE prompts SET favorite = ? WHERE id = ?', flag(favorite), id)
  }

  setArchived(ids: readonly Id[], archived: boolean): void {
    if (ids.length === 0) return
    run(this.db, `UPDATE prompts SET archived = ? WHERE id IN (${placeholders(ids.length)})`, flag(archived), ...ids)
  }

  markUsed(id: Id, at: string, countCopy: boolean): void {
    run(this.db, `UPDATE prompts SET last_used_at = ?, usage_count = usage_count + ? WHERE id = ?`, at, countCopy ? 1 : 0, id)
  }

  delete(ids: readonly Id[]): void {
    if (ids.length === 0) return
    run(this.db, `DELETE FROM prompts WHERE id IN (${placeholders(ids.length)})`, ...ids)
  }

  demoIds(): Id[] {
    return all<{ id: Id }>(this.db, 'SELECT id FROM prompts WHERE is_demo = 1').map((row) => row.id)
  }

  /** (título, contenido) de todos los prompts: base para detectar duplicados al importar. */
  fingerprints(): { id: Id; title: string; content: string }[] {
    return all(this.db, 'SELECT id, title, content FROM prompts')
  }

  deleteAll(): void {
    run(this.db, 'DELETE FROM prompts')
  }
}

/* ---------------------------------- Versiones ---------------------------------- */

interface VersionRow {
  id: Id
  prompt_id: Id
  version: number
  name: string | null
  content: string
  notes: string
  created_at: string
}

const toVersion = (row: VersionRow): PromptVersion => ({
  id: row.id,
  promptId: row.prompt_id,
  version: row.version,
  name: row.name,
  content: row.content,
  notes: row.notes,
  createdAt: row.created_at,
})

export class VersionRepo {
  constructor(private readonly db: Db) {}

  list(promptId: Id): PromptVersion[] {
    return all<VersionRow>(this.db, 'SELECT * FROM prompt_versions WHERE prompt_id = ? ORDER BY version DESC', promptId).map(toVersion)
  }

  find(id: Id): PromptVersion | null {
    const row = one<VersionRow>(this.db, 'SELECT * FROM prompt_versions WHERE id = ?', id)
    return row ? toVersion(row) : null
  }

  get(id: Id): PromptVersion {
    const version = this.find(id)
    if (!version) throw new VaultError('NOT_FOUND', 'La versión no existe (puede haberse eliminado).')
    return version
  }

  /** Siguiente número correlativo: mayor existente + 1 (los huecos intermedios se respetan). */
  nextNumber(promptId: Id): number {
    return (
      one<{ next: number }>(this.db, 'SELECT COALESCE(MAX(version), 0) + 1 AS next FROM prompt_versions WHERE prompt_id = ?', promptId)
        ?.next ?? 1
    )
  }

  insert(version: PromptVersion): void {
    run(
      this.db,
      'INSERT INTO prompt_versions (id, prompt_id, version, name, content, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      version.id,
      version.promptId,
      version.version,
      version.name,
      version.content,
      version.notes,
      version.createdAt,
    )
  }

  delete(id: Id): void {
    run(this.db, 'DELETE FROM prompt_versions WHERE id = ?', id)
  }

  /** ¿Existe ya una versión guardada con exactamente este contenido? */
  hasContent(promptId: Id, content: string): boolean {
    return (
      one(this.db, 'SELECT 1 AS found FROM prompt_versions WHERE prompt_id = ? AND content = ? LIMIT 1', promptId, content) !== undefined
    )
  }
}

/* ---------------------------------- Ajustes ---------------------------------- */

export class SettingsRepo {
  constructor(private readonly db: Db) {}

  get(key: string): string | null {
    return one<{ value: string }>(this.db, 'SELECT value FROM settings WHERE key = ?', key)?.value ?? null
  }

  set(key: string, value: string): void {
    run(this.db, 'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', key, value)
  }
}
