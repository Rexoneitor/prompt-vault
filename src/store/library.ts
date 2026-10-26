import { create } from 'zustand'
import { api, errorMessage } from '@/api/client'
import { GENERAL_TOOL_ID } from '@shared/types'
import type {
  Category,
  CategoryInput,
  Id,
  LibrarySettings,
  Project,
  ProjectInput,
  Prompt,
  PromptDraft,
  SavePromptOptions,
  Tag,
  Tool,
  ToolInput,
  VersionInput,
  PromptVersion,
} from '@shared/types'

/** Reemplaza (o añade) un elemento por id manteniendo el orden. */
function upsert<T extends { id: Id }>(list: readonly T[], item: T): T[] {
  return list.some((entry) => entry.id === item.id) ? list.map((entry) => (entry.id === item.id ? item : entry)) : [...list, item]
}

interface LibraryState {
  status: 'loading' | 'ready' | 'error'
  loadError: string | null
  prompts: Prompt[]
  categories: Category[]
  projects: Project[]
  tags: Tag[]
  tools: Tool[]
  settings: LibrarySettings

  load(): Promise<void>

  createPrompt(draft: PromptDraft): Promise<Prompt>
  updatePrompt(id: Id, draft: PromptDraft, options?: SavePromptOptions): Promise<Prompt>
  duplicatePrompt(id: Id): Promise<Prompt>
  deletePrompts(ids: Id[]): Promise<void>
  setFavorite(id: Id, favorite: boolean): Promise<void>
  setArchived(ids: Id[], archived: boolean): Promise<void>
  recordOpen(id: Id): void
  recordCopy(id: Id): void

  createCategory(input: CategoryInput): Promise<Category>
  updateCategory(id: Id, input: CategoryInput): Promise<void>
  deleteCategory(id: Id): Promise<void>
  reorderCategories(ids: Id[]): Promise<void>
  createProject(input: ProjectInput): Promise<Project>
  updateProject(id: Id, input: ProjectInput): Promise<void>
  deleteProject(id: Id): Promise<void>
  renameTag(id: Id, name: string): Promise<void>
  deleteTag(id: Id): Promise<void>
  createTool(input: ToolInput): Promise<Tool>
  updateTool(id: Id, input: ToolInput): Promise<void>
  deleteTool(id: Id): Promise<void>

  createVersion(promptId: Id, input: VersionInput): Promise<PromptVersion>
  restoreVersion(versionId: Id): Promise<void>
  deleteVersion(versionId: Id): Promise<void>

  markWelcomeDone(): Promise<void>
  recordBackup(): Promise<void>
}

export const useLibrary = create<LibraryState>((set, get) => {
  const replacePrompt = (prompt: Prompt) => set((state) => ({ prompts: upsert(state.prompts, prompt) }))

  return {
    status: 'loading',
    loadError: null,
    prompts: [],
    categories: [],
    projects: [],
    tags: [],
    tools: [],
    settings: { welcomeDone: false, lastBackupAt: null },

    async load() {
      try {
        const library = await api.getLibrary()
        set({ ...library, status: 'ready', loadError: null })
      } catch (error) {
        // Si ya había datos en pantalla, se conservan; el aviso lo muestra quien llamó.
        if (get().status === 'ready') throw error
        set({ status: 'error', loadError: errorMessage(error) })
      }
    },

    async createPrompt(draft) {
      const { prompt, tags } = await api.createPrompt(draft)
      set((state) => ({ prompts: upsert(state.prompts, prompt), tags }))
      return prompt
    },

    async updatePrompt(id, draft, options) {
      const { prompt, tags } = await api.updatePrompt(id, draft, options)
      set((state) => ({ prompts: upsert(state.prompts, prompt), tags }))
      return prompt
    },

    async duplicatePrompt(id) {
      const { prompt, tags } = await api.duplicatePrompt(id)
      set((state) => ({ prompts: upsert(state.prompts, prompt), tags }))
      return prompt
    },

    async deletePrompts(ids) {
      const tags = await api.deletePrompts(ids)
      const removed = new Set(ids)
      set((state) => ({ prompts: state.prompts.filter((p) => !removed.has(p.id)), tags }))
    },

    async setFavorite(id, favorite) {
      replacePrompt(await api.setFavorite(id, favorite))
    },

    async setArchived(ids, archived) {
      const updated = await api.setArchived(ids, archived)
      const byId = new Map(updated.map((p) => [p.id, p]))
      set((state) => ({ prompts: state.prompts.map((p) => byId.get(p.id) ?? p) }))
    },

    recordOpen(id) {
      api.recordOpen(id).then(replacePrompt, () => undefined)
    },

    recordCopy(id) {
      api.recordCopy(id).then(replacePrompt, () => undefined)
    },

    async createCategory(input) {
      const category = await api.createCategory(input)
      set((state) => ({ categories: [...state.categories, category] }))
      return category
    },

    async updateCategory(id, input) {
      const category = await api.updateCategory(id, input)
      set((state) => ({ categories: upsert(state.categories, category) }))
    },

    async deleteCategory(id) {
      await api.deleteCategory(id)
      set((state) => ({
        categories: state.categories.filter((c) => c.id !== id),
        prompts: state.prompts.map((p) => (p.categoryId === id ? { ...p, categoryId: null } : p)),
      }))
    },

    async reorderCategories(ids) {
      // Orden optimista: la lista se reordena al instante y se confirma con el servidor.
      const previous = get().categories
      const position = new Map(ids.map((id, index) => [id, index]))
      set({ categories: [...previous].sort((a, b) => (position.get(a.id) ?? 1e6) - (position.get(b.id) ?? 1e6)) })
      try {
        set({ categories: await api.reorderCategories(ids) })
      } catch (error) {
        set({ categories: previous })
        throw error
      }
    },

    async createProject(input) {
      const project = await api.createProject(input)
      set((state) => ({ projects: [...state.projects, project].sort((a, b) => a.name.localeCompare(b.name, 'es')) }))
      return project
    },

    async updateProject(id, input) {
      const project = await api.updateProject(id, input)
      set((state) => ({ projects: upsert(state.projects, project).sort((a, b) => a.name.localeCompare(b.name, 'es')) }))
    },

    async deleteProject(id) {
      await api.deleteProject(id)
      set((state) => ({
        projects: state.projects.filter((p) => p.id !== id),
        prompts: state.prompts.map((p) => (p.projectId === id ? { ...p, projectId: null } : p)),
      }))
    },

    async renameTag(id, name) {
      await api.renameTag(id, name)
      await get().load() // la fusión de etiquetas toca varios prompts: se recarga
    },

    async deleteTag(id) {
      const tags = await api.deleteTag(id)
      set((state) => ({
        tags,
        prompts: state.prompts.map((p) => (p.tagIds.includes(id) ? { ...p, tagIds: p.tagIds.filter((t) => t !== id) } : p)),
      }))
    },

    async createTool(input) {
      const tool = await api.createTool(input)
      set((state) => ({ tools: [...state.tools, tool] }))
      return tool
    },

    async updateTool(id, input) {
      const tool = await api.updateTool(id, input)
      set((state) => ({ tools: upsert(state.tools, tool) }))
    },

    async deleteTool(id) {
      await api.deleteTool(id)
      set((state) => ({
        tools: state.tools.filter((t) => t.id !== id),
        prompts: state.prompts.map((p) => (p.toolId === id ? { ...p, toolId: GENERAL_TOOL_ID } : p)),
      }))
    },

    async createVersion(promptId, input) {
      const { version, prompt } = await api.createVersion(promptId, input)
      replacePrompt(prompt)
      return version
    },

    async restoreVersion(versionId) {
      replacePrompt(await api.restoreVersion(versionId))
    },

    async deleteVersion(versionId) {
      replacePrompt(await api.deleteVersion(versionId))
    },

    async markWelcomeDone() {
      if (get().settings.welcomeDone) return
      set((state) => ({ settings: { ...state.settings, welcomeDone: true } }))
      await api.markWelcomeDone()
    },

    async recordBackup() {
      const lastBackupAt = await api.recordBackup()
      set((state) => ({ settings: { ...state.settings, lastBackupAt } }))
    },
  }
})
