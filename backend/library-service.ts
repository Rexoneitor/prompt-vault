import { randomUUID } from 'node:crypto'
import { VaultError } from '@shared/errors'
import { DEFAULT_CATEGORY_COLOR, isCategoryColor } from '@shared/palette'
import {
  type Category,
  type CategoryInput,
  type Id,
  type Library,
  type LibrarySettings,
  type Project,
  type ProjectInput,
  type Prompt,
  type PromptDraft,
  type PromptVersion,
  type SavedPrompt,
  type SavePromptOptions,
  type Tag,
  type Tool,
  type ToolInput,
  type VersionInput,
} from '@shared/types'
import { LIMITS, cleanName, normalizeDraft } from '@shared/validation'
import { transaction, type Db } from './db'
import { PromptRepo, SettingsRepo, VersionRepo } from './repos/prompts'
import { CategoryRepo, ProjectRepo, TagRepo, ToolRepo } from './repos/taxonomy'

export interface ServiceOptions {
  now?: () => Date
  newId?: () => string
}

/**
 * Casos de uso de la biblioteca: prompts, taxonomía y versiones.
 * Valida, aplica reglas de negocio y agrupa escrituras en transacciones.
 */
export class LibraryService {
  protected readonly prompts: PromptRepo
  protected readonly versions: VersionRepo
  protected readonly categories: CategoryRepo
  protected readonly projects: ProjectRepo
  protected readonly tags: TagRepo
  protected readonly tools: ToolRepo
  protected readonly settings: SettingsRepo
  protected readonly clock: () => Date
  protected readonly newId: () => string

  constructor(
    protected readonly db: Db,
    options: ServiceOptions = {},
  ) {
    this.prompts = new PromptRepo(db)
    this.versions = new VersionRepo(db)
    this.categories = new CategoryRepo(db)
    this.projects = new ProjectRepo(db)
    this.tags = new TagRepo(db)
    this.tools = new ToolRepo(db)
    this.settings = new SettingsRepo(db)
    this.clock = options.now ?? (() => new Date())
    this.newId = options.newId ?? randomUUID
  }

  protected nowIso(): string {
    return this.clock().toISOString()
  }

  protected librarySettings(): LibrarySettings {
    return {
      welcomeDone: this.settings.get('welcome_done') === '1',
      lastBackupAt: this.settings.get('last_backup_at'),
    }
  }

  async getLibrary(): Promise<Library> {
    return {
      prompts: this.prompts.list(),
      categories: this.categories.list(),
      projects: this.projects.list(),
      tags: this.tags.list(),
      tools: this.tools.list(),
      settings: this.librarySettings(),
    }
  }

  /* ---------------------------------- Prompts ---------------------------------- */

  private assertReferences(draft: PromptDraft): void {
    if (draft.categoryId && !this.categories.get(draft.categoryId)) {
      throw new VaultError('VALIDATION', 'La categoría elegida ya no existe.')
    }
    if (draft.projectId && !this.projects.get(draft.projectId)) {
      throw new VaultError('VALIDATION', 'El proyecto elegido ya no existe.')
    }
    if (!this.tools.get(draft.toolId)) {
      throw new VaultError('VALIDATION', 'La herramienta elegida ya no existe.')
    }
  }

  protected attachTags(promptId: Id, names: readonly string[], at: string): void {
    const ids = names.map((name) => this.tags.getOrCreate(name, this.newId(), at))
    this.tags.replaceFor(promptId, ids)
  }

  private saved(id: Id): SavedPrompt {
    return { prompt: this.prompts.get(id), tags: this.tags.list() }
  }

  async createPrompt(input: PromptDraft): Promise<SavedPrompt> {
    const draft = normalizeDraft(input)
    this.assertReferences(draft)
    const id = this.newId()
    const at = this.nowIso()
    transaction(this.db, () => {
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
        lastUsedAt: at,
      })
      this.attachTags(id, draft.tags, at)
    })
    return this.saved(id)
  }

  async updatePrompt(id: Id, input: PromptDraft, options: SavePromptOptions = {}): Promise<SavedPrompt> {
    const draft = normalizeDraft(input)
    this.assertReferences(draft)
    const current = this.prompts.get(id)
    const at = this.nowIso()
    transaction(this.db, () => {
      if (options.snapshotPrevious && !this.versions.hasContent(id, current.content)) {
        this.insertVersion(current, options.snapshotPrevious.name, options.snapshotPrevious.notes ?? '', at, current.content)
      }
      this.prompts.update(id, draft, at)
      this.attachTags(id, draft.tags, at)
      this.tags.deleteOrphans()
    })
    return this.saved(id)
  }

  async duplicatePrompt(id: Id): Promise<SavedPrompt> {
    const source = this.prompts.get(id)
    const tagNames = this.tags
      .list()
      .filter((tag) => source.tagIds.includes(tag.id))
      .map((tag) => tag.name)
    const copyId = this.newId()
    const at = this.nowIso()
    transaction(this.db, () => {
      this.prompts.insert({
        id: copyId,
        title: `${source.title} (copia)`.slice(0, LIMITS.title),
        description: source.description,
        content: source.content,
        notes: source.notes,
        categoryId: source.categoryId,
        projectId: source.projectId,
        toolId: source.toolId,
        favorite: false,
        archived: false,
        isDemo: false,
        usageCount: 0,
        createdAt: at,
        updatedAt: at,
        lastUsedAt: at,
      })
      this.attachTags(copyId, tagNames, at)
    })
    return this.saved(copyId)
  }

  async deletePrompts(ids: Id[]): Promise<Tag[]> {
    transaction(this.db, () => {
      this.prompts.delete(ids)
      this.tags.deleteOrphans()
    })
    return this.tags.list()
  }

  async setFavorite(id: Id, favorite: boolean): Promise<Prompt> {
    this.prompts.get(id)
    this.prompts.setFavorite(id, favorite)
    return this.prompts.get(id)
  }

  async setArchived(ids: Id[], archived: boolean): Promise<Prompt[]> {
    this.prompts.setArchived(ids, archived)
    return this.prompts.many(ids)
  }

  async recordOpen(id: Id): Promise<Prompt> {
    this.prompts.get(id)
    this.prompts.markUsed(id, this.nowIso(), false)
    return this.prompts.get(id)
  }

  async recordCopy(id: Id): Promise<Prompt> {
    this.prompts.get(id)
    this.prompts.markUsed(id, this.nowIso(), true)
    return this.prompts.get(id)
  }

  /* --------------------------------- Taxonomía --------------------------------- */

  private colorOrDefault(color: string): string {
    return isCategoryColor(color) ? color : DEFAULT_CATEGORY_COLOR
  }

  async createCategory(input: CategoryInput): Promise<Category> {
    const at = this.nowIso()
    return this.categories.insert({
      id: this.newId(),
      name: cleanName(input.name, 'El nombre de la categoría'),
      color: this.colorOrDefault(input.color),
      createdAt: at,
      updatedAt: at,
    })
  }

  async updateCategory(id: Id, input: CategoryInput): Promise<Category> {
    return this.categories.update(id, cleanName(input.name, 'El nombre de la categoría'), this.colorOrDefault(input.color), this.nowIso())
  }

  async deleteCategory(id: Id): Promise<void> {
    this.categories.delete(id)
  }

  async reorderCategories(ids: Id[]): Promise<Category[]> {
    const existing = this.categories.list().map((category) => category.id)
    const known = new Set(existing)
    const ordered = [...new Set(ids)].filter((id) => known.has(id))
    const rest = existing.filter((id) => !ordered.includes(id))
    transaction(this.db, () => this.categories.reorder([...ordered, ...rest]))
    return this.categories.list()
  }

  async createProject(input: ProjectInput): Promise<Project> {
    const at = this.nowIso()
    return this.projects.insert({
      id: this.newId(),
      name: cleanName(input.name, 'El nombre del proyecto'),
      description: (input.description ?? '').trim().slice(0, LIMITS.description),
      isDemo: false,
      createdAt: at,
      updatedAt: at,
    })
  }

  async updateProject(id: Id, input: ProjectInput): Promise<Project> {
    return this.projects.update(
      id,
      cleanName(input.name, 'El nombre del proyecto'),
      (input.description ?? '').trim().slice(0, LIMITS.description),
      this.nowIso(),
    )
  }

  async deleteProject(id: Id): Promise<void> {
    this.projects.delete(id)
  }

  async renameTag(id: Id, name: string): Promise<Tag[]> {
    transaction(this.db, () => this.tags.rename(id, cleanName(name, 'El nombre de la etiqueta', LIMITS.tagName).replace(/^#+/, '')))
    return this.tags.list()
  }

  async deleteTag(id: Id): Promise<Tag[]> {
    this.tags.delete(id)
    return this.tags.list()
  }

  async createTool(input: ToolInput): Promise<Tool> {
    return this.tools.insert(
      { id: this.newId(), name: cleanName(input.name, 'El nombre de la herramienta'), sortOrder: this.tools.nextSortOrder() },
      this.nowIso(),
    )
  }

  async updateTool(id: Id, input: ToolInput): Promise<Tool> {
    return this.tools.update(id, cleanName(input.name, 'El nombre de la herramienta'), this.nowIso())
  }

  async deleteTool(id: Id): Promise<void> {
    transaction(this.db, () => this.tools.delete(id))
  }

  /* ---------------------------------- Versiones ---------------------------------- */

  private insertVersion(prompt: Prompt, name: string | undefined, notes: string, at: string, content: string): PromptVersion {
    const cleanVersionName = (name ?? '').replace(/\s+/g, ' ').trim()
    if (cleanVersionName.length > LIMITS.name) {
      throw new VaultError('VALIDATION', `El nombre de la versión supera el máximo de ${LIMITS.name} caracteres.`)
    }
    const version: PromptVersion = {
      id: this.newId(),
      promptId: prompt.id,
      version: this.versions.nextNumber(prompt.id),
      name: cleanVersionName || null,
      content,
      notes: notes.trim().slice(0, LIMITS.description),
      createdAt: at,
    }
    this.versions.insert(version)
    return version
  }

  async listVersions(promptId: Id): Promise<PromptVersion[]> {
    this.prompts.get(promptId)
    return this.versions.list(promptId)
  }

  async createVersion(promptId: Id, input: VersionInput): Promise<{ version: PromptVersion; prompt: Prompt }> {
    const prompt = this.prompts.get(promptId)
    const version = transaction(this.db, () => this.insertVersion(prompt, input.name, input.notes ?? '', this.nowIso(), prompt.content))
    return { version, prompt: this.prompts.get(promptId) }
  }

  /**
   * Devuelve el contenido de una versión al prompt. Si el contenido actual no estaba guardado
   * en el historial, se conserva antes como versión de seguridad: restaurar nunca pierde nada.
   */
  async restoreVersion(versionId: Id): Promise<Prompt> {
    const version = this.versions.get(versionId)
    const prompt = this.prompts.get(version.promptId)
    const at = this.nowIso()
    transaction(this.db, () => {
      if (prompt.content !== version.content && !this.versions.hasContent(prompt.id, prompt.content)) {
        this.insertVersion(prompt, `Antes de restaurar v${version.version}`, '', at, prompt.content)
      }
      this.prompts.update(prompt.id, { ...prompt, content: version.content }, at)
    })
    return this.prompts.get(prompt.id)
  }

  async deleteVersion(versionId: Id): Promise<Prompt> {
    const version = this.versions.get(versionId)
    this.versions.delete(versionId)
    return this.prompts.get(version.promptId)
  }
}
