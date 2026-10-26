import { VaultError } from '@shared/errors'
import type { VaultApi } from '@shared/api'
import { BACKUP_APP, BACKUP_FORMAT_VERSION, parseBackup, serializeBackup, type BackupFile } from '@shared/formats/backup'
import { makeExportFile, promptsToCsv, promptsToMarkdown, promptsToText, type ResolvedPrompt } from '@shared/formats/export'
import { parseImport } from '@shared/formats/import'
import { CATEGORY_COLORS } from '@shared/palette'
import { collapseSpaces, nameKey } from '@shared/text'
import {
  GENERAL_TOOL_ID,
  type ExportFile,
  type ExportRequest,
  type Id,
  type ImportCandidate,
  type ImportInput,
  type ImportPreview,
  type ImportResult,
  type Prompt,
  type RestoreResult,
  type StorageInfo,
} from '@shared/types'
import { LIMITS, normalizeDraft } from '@shared/validation'
import { DEMO_PROJECTS, DEMO_PROMPTS } from './demo-data'
import { run, transaction, type Db } from './db'
import { LibraryService, type ServiceOptions } from './library-service'
import { ensureGeneralTool } from './seed'

export interface VaultServiceOptions extends ServiceOptions {
  /** Datos de almacenamiento para la pantalla de Ajustes. */
  storageInfo?: () => StorageInfo
  /** Se invoca antes de operaciones destructivas (restaurar) para dejar una copia de seguridad. */
  safetySnapshot?: (reason: 'restore') => void
}

const MAX_IMPORT_ITEMS = 5_000
const DAY_MS = 86_400_000

/** Implementación completa de `VaultApi` sobre SQLite. */
export class VaultService extends LibraryService implements VaultApi {
  constructor(
    db: Db,
    private readonly options: VaultServiceOptions = {},
  ) {
    super(db, options)
  }

  async getStorageInfo(): Promise<StorageInfo> {
    return this.options.storageInfo?.() ?? { engine: 'SQLite (memoria)', location: '', backupsDir: '', sizeBytes: 0 }
  }

  async markWelcomeDone(): Promise<void> {
    this.settings.set('welcome_done', '1')
  }

  /* ----------------------------------- Exportar ----------------------------------- */

  private resolvePrompts(prompts: readonly Prompt[]): ResolvedPrompt[] {
    const categories = new Map(this.categories.list().map((c) => [c.id, c.name]))
    const projects = new Map(this.projects.list().map((p) => [p.id, p.name]))
    const tools = new Map(this.tools.list().map((t) => [t.id, t.name]))
    const tags = new Map(this.tags.list().map((t) => [t.id, t.name]))
    return prompts.map((p) => ({
      id: p.id,
      title: p.title,
      description: p.description,
      content: p.content,
      notes: p.notes,
      category: p.categoryId ? (categories.get(p.categoryId) ?? null) : null,
      project: p.projectId ? (projects.get(p.projectId) ?? null) : null,
      tool: tools.get(p.toolId) ?? 'General',
      tags: p.tagIds.map((id) => tags.get(id) ?? '').filter(Boolean),
      favorite: p.favorite,
      archived: p.archived,
      usageCount: p.usageCount,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
      lastUsedAt: p.lastUsedAt,
    }))
  }

  private selectPrompts(ids?: readonly Id[]): Prompt[] {
    const all = this.prompts.list()
    if (!ids) return all
    const wanted = new Set(ids)
    return all.filter((p) => wanted.has(p.id))
  }

  /** Contenido completo en formato propio. Con `subset` solo incluye lo que esos prompts referencian. */
  private buildBackup(prompts: readonly Prompt[], partial: boolean): BackupFile {
    const tagNames = new Map(this.tags.list().map((t) => [t.id, t.name]))
    const usedCategories = new Set(prompts.map((p) => p.categoryId))
    const usedProjects = new Set(prompts.map((p) => p.projectId))
    const usedTools = new Set(prompts.map((p) => p.toolId))
    return {
      app: BACKUP_APP,
      formatVersion: BACKUP_FORMAT_VERSION,
      exportedAt: this.nowIso(),
      categories: this.categories.list().filter((c) => !partial || usedCategories.has(c.id)),
      projects: this.projects.list().filter((p) => !partial || usedProjects.has(p.id)),
      tools: this.tools.list().filter((t) => !partial || usedTools.has(t.id)),
      prompts: prompts.map((p) => ({
        id: p.id,
        title: p.title,
        description: p.description,
        content: p.content,
        notes: p.notes,
        categoryId: p.categoryId,
        projectId: p.projectId,
        toolId: p.toolId,
        tags: p.tagIds.map((id) => tagNames.get(id) ?? '').filter(Boolean),
        favorite: p.favorite,
        archived: p.archived,
        isDemo: p.isDemo,
        usageCount: p.usageCount,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
        lastUsedAt: p.lastUsedAt,
        versions: this.versions.list(p.id).map((v) => ({
          id: v.id,
          version: v.version,
          name: v.name,
          content: v.content,
          notes: v.notes,
          createdAt: v.createdAt,
        })),
      })),
    }
  }

  async exportLibrary(request: ExportRequest): Promise<ExportFile> {
    const prompts = this.selectPrompts(request.ids)
    if (prompts.length === 0) throw new VaultError('VALIDATION', 'No hay prompts que exportar.')
    const now = this.clock()
    switch (request.format) {
      case 'json':
        return makeExportFile('export', 'json', serializeBackup(this.buildBackup(prompts, request.ids !== undefined)), prompts.length, now)
      case 'csv':
        return makeExportFile('export', 'csv', promptsToCsv(this.resolvePrompts(prompts)), prompts.length, now)
      case 'markdown':
        return makeExportFile('export', 'markdown', promptsToMarkdown(this.resolvePrompts(prompts), now), prompts.length, now)
      case 'txt':
        return makeExportFile('export', 'txt', promptsToText(this.resolvePrompts(prompts), now), prompts.length, now)
      default:
        throw new VaultError('VALIDATION', 'Formato de exportación no admitido.')
    }
  }

  async createBackup(): Promise<ExportFile> {
    const prompts = this.prompts.list()
    return makeExportFile('backup', 'json', serializeBackup(this.buildBackup(prompts, false)), prompts.length, this.clock())
  }

  async recordBackup(): Promise<string> {
    const at = this.nowIso()
    this.settings.set('last_backup_at', at)
    return at
  }

  /* ------------------------------------ Restaurar ------------------------------------ */

  async restoreBackup(content: string): Promise<RestoreResult> {
    // Se valida por completo ANTES de tocar nada: un archivo corrupto no daña los datos actuales.
    const { backup, warnings } = parseBackup(content)
    this.options.safetySnapshot?.('restore')
    const at = this.nowIso()

    transaction(this.db, () => {
      this.prompts.deleteAll()
      run(this.db, 'DELETE FROM tags')
      run(this.db, 'DELETE FROM categories')
      run(this.db, 'DELETE FROM projects')
      run(this.db, 'DELETE FROM tools')

      for (const category of backup.categories) this.categories.insert(category)
      for (const project of backup.projects) this.projects.insert(project)
      for (const tool of backup.tools) this.tools.insert(tool, at)
      ensureGeneralTool(this.db, at)

      for (const p of backup.prompts) {
        this.prompts.insert({
          id: p.id,
          title: p.title,
          description: p.description,
          content: p.content,
          notes: p.notes,
          categoryId: p.categoryId,
          projectId: p.projectId,
          toolId: p.toolId,
          favorite: p.favorite,
          archived: p.archived,
          isDemo: p.isDemo,
          usageCount: p.usageCount,
          createdAt: p.createdAt,
          updatedAt: p.updatedAt,
          lastUsedAt: p.lastUsedAt,
        })
        this.attachTags(p.id, p.tags, at)
        for (const v of p.versions) this.versions.insert({ ...v, promptId: p.id })
      }
      this.settings.set('seeded', '1')
    })
    return { prompts: backup.prompts.length, warnings }
  }

  /* ------------------------------------ Importar ------------------------------------ */

  private static fingerprint(content: string): string {
    return content.replace(/\s+/g, ' ').trim()
  }

  async previewImport(input: ImportInput): Promise<ImportPreview> {
    const parsed = parseImport(input)
    if (parsed.drafts.length > MAX_IMPORT_ITEMS) {
      throw new VaultError('IMPORT_INVALID', `El archivo tiene demasiados prompts (máximo ${MAX_IMPORT_ITEMS} por importación).`)
    }
    if (parsed.drafts.length === 0) {
      throw new VaultError('IMPORT_INVALID', 'No se encontró ningún prompt con contenido en el archivo.')
    }

    const known = new Set(this.prompts.fingerprints().map((row) => VaultService.fingerprint(row.content)))
    const candidates: ImportCandidate[] = parsed.drafts.map((draft, index) => {
      const fingerprint = VaultService.fingerprint(draft.content)
      const duplicate = known.has(fingerprint)
      known.add(fingerprint) // también detecta repetidos dentro del propio archivo
      return { ...draft, key: `candidate-${index}`, status: duplicate ? 'duplicate' : 'new' }
    })
    return { source: parsed.source, candidates, skipped: parsed.skipped, warnings: parsed.warnings }
  }

  async commitImport(candidates: ImportCandidate[]): Promise<ImportResult> {
    if (candidates.length === 0) return { imported: 0 }
    if (candidates.length > MAX_IMPORT_ITEMS) throw new VaultError('IMPORT_INVALID', 'Demasiados prompts en una sola importación.')
    const at = this.nowIso()

    transaction(this.db, () => {
      candidates.forEach((candidate, index) => {
        const categoryId = candidate.categoryName ? this.categoryByName(candidate.categoryName, at, index) : null
        const projectId = candidate.projectName ? this.projectByName(candidate.projectName, at) : null
        const toolId = candidate.toolName ? this.toolByName(candidate.toolName, at) : GENERAL_TOOL_ID
        const draft = normalizeDraft({
          title: candidate.title,
          description: candidate.description,
          content: candidate.content,
          notes: candidate.notes,
          categoryId,
          projectId,
          toolId,
          tags: candidate.tags,
          favorite: candidate.favorite,
        })
        const id = this.newId()
        this.prompts.insert({
          id,
          title: draft.title,
          description: draft.description,
          content: draft.content,
          notes: draft.notes,
          categoryId: draft.categoryId,
          projectId: draft.projectId,
          toolId: draft.toolId,
          favorite: draft.favorite,
          archived: false,
          isDemo: false,
          usageCount: 0,
          createdAt: at,
          updatedAt: at,
          lastUsedAt: null,
        })
        this.attachTags(id, draft.tags, at)
        candidate.versions.forEach((v, order) => {
          this.versions.insert({
            id: this.newId(),
            promptId: id,
            version: order + 1,
            name: v.name,
            content: v.content,
            notes: v.notes,
            createdAt: v.createdAt ?? at,
          })
        })
      })
    })
    return { imported: candidates.length }
  }

  private categoryByName(name: string, at: string, seed: number): Id {
    const clean = collapseSpaces(name).slice(0, LIMITS.name)
    const existing = this.categories.findByName(clean)
    if (existing) return existing.id
    return this.categories.insert({
      id: this.newId(),
      name: clean,
      color: CATEGORY_COLORS[seed % CATEGORY_COLORS.length],
      createdAt: at,
      updatedAt: at,
    }).id
  }

  private projectByName(name: string, at: string): Id {
    const clean = collapseSpaces(name).slice(0, LIMITS.name)
    const existing = this.projects.findByName(clean)
    if (existing) return existing.id
    return this.projects.insert({ id: this.newId(), name: clean, description: '', isDemo: false, createdAt: at, updatedAt: at }).id
  }

  private toolByName(name: string, at: string): Id {
    const clean = collapseSpaces(name).slice(0, LIMITS.name)
    if (nameKey(clean) === nameKey('General')) return GENERAL_TOOL_ID
    const existing = this.tools.findByName(clean)
    if (existing) return existing.id
    return this.tools.insert({ id: this.newId(), name: clean, sortOrder: this.tools.nextSortOrder() }, at).id
  }

  /* ------------------------------------ Demostración ------------------------------------ */

  async loadDemoData(): Promise<number> {
    if (this.prompts.demoIds().length > 0) return 0
    const now = this.clock().getTime()
    const iso = (daysAgo: number) => new Date(now - daysAgo * DAY_MS).toISOString()
    const at = this.nowIso()

    transaction(this.db, () => {
      const projectIds = new Map<string, Id>()
      for (const demo of DEMO_PROJECTS) {
        const existing = this.projects.findByName(demo.name)
        if (existing) {
          projectIds.set(demo.name, existing.id)
          continue
        }
        const project = this.projects.insert({
          id: this.newId(),
          name: demo.name,
          description: demo.description,
          isDemo: true,
          createdAt: at,
          updatedAt: at,
        })
        projectIds.set(demo.name, project.id)
      }

      for (const demo of DEMO_PROMPTS) {
        const id = this.newId()
        const created = iso(demo.createdDaysAgo)
        this.prompts.insert({
          id,
          title: demo.title,
          description: demo.description,
          content: demo.content,
          notes: demo.notes ?? '',
          categoryId: this.categories.findByName(demo.category)?.id ?? null,
          projectId: demo.project ? (projectIds.get(demo.project) ?? null) : null,
          toolId: this.tools.get(demo.tool) ? demo.tool : GENERAL_TOOL_ID,
          favorite: demo.favorite ?? false,
          archived: false,
          isDemo: true,
          usageCount: demo.usageCount,
          createdAt: created,
          updatedAt: created,
          lastUsedAt: demo.usedDaysAgo === null ? null : iso(demo.usedDaysAgo),
        })
        this.attachTags(id, demo.tags, at)
        demo.versions?.forEach((v, order) => {
          this.versions.insert({
            id: this.newId(),
            promptId: id,
            version: order + 1,
            name: v.name ?? null,
            content: v.content,
            notes: v.notes,
            createdAt: iso(Math.max(demo.createdDaysAgo - order - 1, 0)),
          })
        })
      }
    })
    return DEMO_PROMPTS.length
  }

  async removeDemoData(): Promise<number> {
    const ids = this.prompts.demoIds()
    transaction(this.db, () => {
      this.prompts.delete(ids)
      this.projects.deleteEmptyDemo()
      this.tags.deleteOrphans()
    })
    return ids.length
  }
}
