/** Modelo de dominio compartido entre backend y renderer. Todo es serializable (JSON/IPC). */

export type Id = string
/** ISO-8601 en UTC. */
export type IsoDate = string

export const GENERAL_TOOL_ID = 'general'

export interface Category {
  id: Id
  name: string
  /** Clave de la paleta (`shared/palette.ts`). */
  color: string
  sortOrder: number
  createdAt: IsoDate
  updatedAt: IsoDate
}

export interface Project {
  id: Id
  name: string
  description: string
  isDemo: boolean
  createdAt: IsoDate
  updatedAt: IsoDate
}

export interface Tag {
  id: Id
  name: string
}

/** Herramienta/IA objetivo. Ampliable por el usuario; `general` es fija. */
export interface Tool {
  id: Id
  name: string
  sortOrder: number
}

export interface Prompt {
  id: Id
  title: string
  description: string
  content: string
  notes: string
  categoryId: Id | null
  projectId: Id | null
  toolId: Id
  tagIds: Id[]
  favorite: boolean
  archived: boolean
  isDemo: boolean
  usageCount: number
  versionCount: number
  createdAt: IsoDate
  updatedAt: IsoDate
  lastUsedAt: IsoDate | null
}

export interface PromptVersion {
  id: Id
  promptId: Id
  version: number
  name: string | null
  content: string
  notes: string
  createdAt: IsoDate
}

/** Campos editables de un prompt. Las etiquetas viajan por nombre; el backend las resuelve. */
export interface PromptDraft {
  title: string
  description: string
  content: string
  notes: string
  categoryId: Id | null
  projectId: Id | null
  toolId: Id
  tags: string[]
  favorite: boolean
}

export interface SavePromptOptions {
  /** Guarda el contenido anterior como versión antes de aplicar los cambios. */
  snapshotPrevious?: { name?: string; notes?: string }
}

/** Resultado de crear/editar: incluye la lista actualizada de etiquetas (pueden nacer nuevas). */
export interface SavedPrompt {
  prompt: Prompt
  tags: Tag[]
}

export interface CategoryInput {
  name: string
  color: string
}

export interface ProjectInput {
  name: string
  description: string
}

export interface ToolInput {
  name: string
}

export interface VersionInput {
  name?: string
  notes?: string
}

export interface LibrarySettings {
  welcomeDone: boolean
  lastBackupAt: IsoDate | null
}

export interface Library {
  prompts: Prompt[]
  categories: Category[]
  projects: Project[]
  tags: Tag[]
  tools: Tool[]
  settings: LibrarySettings
}

export interface StorageInfo {
  engine: string
  /** Ruta del archivo de base de datos (vacío si el backend no es local). */
  location: string
  backupsDir: string
  sizeBytes: number
}

/* ------------------------------ Importar / Exportar ------------------------------ */

export type ExportFormat = 'json' | 'csv' | 'markdown' | 'txt'

export interface ExportRequest {
  format: ExportFormat
  /** Si se omite, se exporta toda la biblioteca. */
  ids?: Id[]
}

export interface ExportFile {
  filename: string
  mimeType: string
  content: string
  count: number
}

export interface ImportVersionDraft {
  name: string | null
  content: string
  notes: string
  createdAt?: IsoDate
}

/** Prompt tal como sale de un archivo/texto, antes de resolver contra la biblioteca. */
export interface ImportDraft {
  title: string
  description: string
  content: string
  notes: string
  categoryName: string | null
  projectName: string | null
  toolName: string | null
  tags: string[]
  favorite: boolean
  versions: ImportVersionDraft[]
}

export interface ImportCandidate extends ImportDraft {
  /** Clave temporal para la selección en la vista previa. */
  key: string
  status: 'new' | 'duplicate'
}

export type ImportSource = 'json' | 'csv' | 'markdown' | 'text'

export type ImportInput =
  | { kind: 'text'; content: string }
  /** `asSingle`: tratar un archivo Markdown completo como un único prompt, sin dividirlo por títulos. */
  | { kind: 'file'; filename: string; content: string; asSingle?: boolean }

export interface ImportPreview {
  source: ImportSource
  candidates: ImportCandidate[]
  /** Elementos del archivo descartados por no tener contenido. */
  skipped: number
  warnings: string[]
}

export interface ImportResult {
  imported: number
}

export interface RestoreResult {
  prompts: number
  warnings: string[]
}
