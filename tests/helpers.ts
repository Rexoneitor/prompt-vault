import { openDatabase } from '@backend/db'
import { seedDefaults } from '@backend/seed'
import { VaultService, type VaultServiceOptions } from '@backend/vault-service'
import { GENERAL_TOOL_ID, type PromptDraft } from '@shared/types'

/** Servicio sobre SQLite en memoria con reloj determinista (cada llamada avanza 1 s). */
export function createTestService(options: VaultServiceOptions = {}) {
  const db = openDatabase(':memory:')
  let tick = Date.parse('2026-01-01T10:00:00Z')
  let counter = 0
  const now = () => new Date((tick += 1000))
  const newId = () => `id-${++counter}`
  seedDefaults(db, newId, now().toISOString())
  const service = new VaultService(db, { now, newId, ...options })
  return { db, service }
}

export function draft(overrides: Partial<PromptDraft> = {}): PromptDraft {
  return {
    title: 'Título de prueba',
    description: '',
    content: 'Contenido de prueba',
    notes: '',
    categoryId: null,
    projectId: null,
    toolId: GENERAL_TOOL_ID,
    tags: [],
    favorite: false,
    ...overrides,
  }
}
