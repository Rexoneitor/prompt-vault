import type {
  Category,
  CategoryInput,
  ExportFile,
  ExportRequest,
  Id,
  ImportCandidate,
  ImportInput,
  ImportPreview,
  ImportResult,
  Library,
  Project,
  ProjectInput,
  Prompt,
  PromptDraft,
  PromptVersion,
  RestoreResult,
  SavedPrompt,
  SavePromptOptions,
  StorageInfo,
  Tag,
  Tool,
  ToolInput,
  VersionInput,
} from './types'

/**
 * Contrato único entre la interfaz y el almacenamiento.
 * Hoy lo implementa `VaultService` (SQLite local) tras IPC o HTTP; mañana puede
 * implementarlo un servicio remoto con otra base de datos sin tocar la interfaz.
 */
export interface VaultApi {
  getLibrary(): Promise<Library>
  getStorageInfo(): Promise<StorageInfo>

  /* Prompts */
  createPrompt(draft: PromptDraft): Promise<SavedPrompt>
  updatePrompt(id: Id, draft: PromptDraft, options?: SavePromptOptions): Promise<SavedPrompt>
  duplicatePrompt(id: Id): Promise<SavedPrompt>
  /** Devuelve la lista de etiquetas resultante (las huérfanas se eliminan). */
  deletePrompts(ids: Id[]): Promise<Tag[]>
  setFavorite(id: Id, favorite: boolean): Promise<Prompt>
  setArchived(ids: Id[], archived: boolean): Promise<Prompt[]>
  /** Registra que el prompt se abrió (actualiza «último uso»). */
  recordOpen(id: Id): Promise<Prompt>
  /** Registra una copia (actualiza «último uso» y suma al contador). */
  recordCopy(id: Id): Promise<Prompt>

  /* Taxonomía */
  createCategory(input: CategoryInput): Promise<Category>
  updateCategory(id: Id, input: CategoryInput): Promise<Category>
  deleteCategory(id: Id): Promise<void>
  reorderCategories(ids: Id[]): Promise<Category[]>
  createProject(input: ProjectInput): Promise<Project>
  updateProject(id: Id, input: ProjectInput): Promise<Project>
  deleteProject(id: Id): Promise<void>
  /** Si el nuevo nombre ya existe, las etiquetas se fusionan. Devuelve la lista completa. */
  renameTag(id: Id, name: string): Promise<Tag[]>
  deleteTag(id: Id): Promise<Tag[]>
  createTool(input: ToolInput): Promise<Tool>
  updateTool(id: Id, input: ToolInput): Promise<Tool>
  deleteTool(id: Id): Promise<void>

  /* Versiones */
  listVersions(promptId: Id): Promise<PromptVersion[]>
  createVersion(promptId: Id, input: VersionInput): Promise<{ version: PromptVersion; prompt: Prompt }>
  restoreVersion(versionId: Id): Promise<Prompt>
  deleteVersion(versionId: Id): Promise<Prompt>

  /* Datos */
  exportLibrary(request: ExportRequest): Promise<ExportFile>
  createBackup(): Promise<ExportFile>
  /** Anota que el backup se guardó de verdad (no al generarlo). Devuelve la fecha registrada. */
  recordBackup(): Promise<string>
  restoreBackup(content: string): Promise<RestoreResult>
  previewImport(input: ImportInput): Promise<ImportPreview>
  commitImport(candidates: ImportCandidate[]): Promise<ImportResult>
  loadDemoData(): Promise<number>
  removeDemoData(): Promise<number>
  markWelcomeDone(): Promise<void>
}

/** Lista blanca de métodos invocables por RPC. El compilador exige que esté completa. */
export const API_METHODS = [
  'getLibrary',
  'getStorageInfo',
  'createPrompt',
  'updatePrompt',
  'duplicatePrompt',
  'deletePrompts',
  'setFavorite',
  'setArchived',
  'recordOpen',
  'recordCopy',
  'createCategory',
  'updateCategory',
  'deleteCategory',
  'reorderCategories',
  'createProject',
  'updateProject',
  'deleteProject',
  'renameTag',
  'deleteTag',
  'createTool',
  'updateTool',
  'deleteTool',
  'listVersions',
  'createVersion',
  'restoreVersion',
  'deleteVersion',
  'exportLibrary',
  'createBackup',
  'recordBackup',
  'restoreBackup',
  'previewImport',
  'commitImport',
  'loadDemoData',
  'removeDemoData',
  'markWelcomeDone',
] as const satisfies readonly (keyof VaultApi)[]

type MissingMethods = Exclude<keyof VaultApi, (typeof API_METHODS)[number]>
export const _apiMethodsAreComplete: [MissingMethods] extends [never] ? true : never = true

export type ApiMethod = (typeof API_METHODS)[number]

export function isApiMethod(name: string): name is ApiMethod {
  return (API_METHODS as readonly string[]).includes(name)
}
