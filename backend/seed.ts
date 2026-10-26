import { GENERAL_TOOL_ID } from '@shared/types'
import type { CategoryColor } from '@shared/palette'
import { transaction, run, type Db } from './db'
import { SettingsRepo } from './repos/prompts'
import { CategoryRepo, ToolRepo } from './repos/taxonomy'

const DEFAULT_CATEGORIES: readonly [string, CategoryColor][] = [
  ['Programación', 'indigo'],
  ['Negocios', 'slate'],
  ['Marketing', 'rose'],
  ['Emprendimiento', 'orange'],
  ['Diseño', 'violet'],
  ['Investigación', 'sky'],
  ['Escritura', 'amber'],
  ['Productividad', 'emerald'],
  ['Educación', 'lime'],
  ['Análisis', 'teal'],
  ['IA', 'indigo'],
  ['Imagen', 'pink'],
  ['Video', 'rose'],
  ['Redes sociales', 'sky'],
  ['Personal', 'slate'],
]

/** Ids fijos: así «Claude» es la misma herramienta en cualquier instalación (útil para sincronizar). */
const DEFAULT_TOOLS: readonly [id: string, name: string][] = [
  [GENERAL_TOOL_ID, 'General'],
  ['chatgpt', 'ChatGPT'],
  ['claude', 'Claude'],
  ['gemini', 'Gemini'],
  ['perplexity', 'Perplexity'],
  ['midjourney', 'Midjourney'],
  ['cursor', 'Cursor'],
  ['lovable', 'Lovable'],
  ['claude-code', 'Claude Code'],
  ['otros', 'Otros'],
]

/**
 * Crea las categorías y herramientas iniciales la primera vez que se abre la base de datos.
 * Se marca en `settings` para no volver a crearlas si el usuario las elimina.
 */
export function seedDefaults(db: Db, newId: () => string, nowIso: string): void {
  const settings = new SettingsRepo(db)
  if (settings.get('seeded') === '1') return

  transaction(db, () => {
    const categories = new CategoryRepo(db)
    DEFAULT_CATEGORIES.forEach(([name, color], index) => {
      categories.insert({ id: newId(), name, color, sortOrder: index, createdAt: nowIso, updatedAt: nowIso })
    })
    const tools = new ToolRepo(db)
    DEFAULT_TOOLS.forEach(([id, name], index) => {
      if (!tools.get(id)) tools.insert({ id, name, sortOrder: index }, nowIso)
    })
    settings.set('seeded', '1')
  })
}

/** La herramienta «General» debe existir siempre (la usan los prompts sin herramienta concreta). */
export function ensureGeneralTool(db: Db, nowIso: string): void {
  run(
    db,
    `INSERT OR IGNORE INTO tools (id, name, sort_order, created_at, updated_at) VALUES (?, 'General', 0, ?, ?)`,
    GENERAL_TOOL_ID,
    nowIso,
    nowIso,
  )
}
