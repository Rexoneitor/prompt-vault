import { api } from '@/api/client'
import { pickTextFile, saveFile } from '@/api/platform'
import { useLibrary } from '@/store/library'
import { attempt, useUi } from '@/store/ui'
import { pluralize } from '@shared/text'
import type { ExportRequest } from '@shared/types'

/** Exporta (todo o una selección) y guarda el archivo. Devuelve true si se guardó. */
export async function runExport(request: ExportRequest): Promise<boolean> {
  const saved = await attempt(async () => {
    const file = await api.exportLibrary(request)
    const result = await saveFile(file)
    return result.saved ? file : null
  })
  if (saved) useUi.getState().toast(`Exportado: ${pluralize(saved.count, 'prompt', 'prompts')}`)
  return Boolean(saved)
}

/** Crea el backup completo (JSON), lo guarda y anota la fecha solo si de verdad se guardó. */
export async function runBackup(): Promise<boolean> {
  const file = await attempt(async () => {
    const backup = await api.createBackup()
    const result = await saveFile(backup)
    if (!result.saved) return null
    await useLibrary.getState().recordBackup()
    return backup
  })
  if (file) useUi.getState().toast(`Backup guardado: ${pluralize(file.count, 'prompt', 'prompts')}`)
  return Boolean(file)
}

function looksLikeBackup(content: string): boolean {
  try {
    return (JSON.parse(content.replace(/^﻿/, '')) as { app?: unknown }).app === 'prompt-vault'
  } catch {
    return false
  }
}

/** Restaura un backup: valida el archivo, pide confirmación y reemplaza la biblioteca de forma atómica. */
export async function runRestore(): Promise<boolean> {
  const picked = await attempt(() => pickTextFile('.json,application/json'))
  if (!picked) return false

  // Se valida ANTES de preguntar: si el archivo no sirve, no hay nada que confirmar.
  if (!looksLikeBackup(picked.content)) {
    useUi.getState().toast('Este archivo no es un backup de Prompt Vault (o está dañado).', 'error')
    return false
  }
  const preview = await attempt(() => api.previewImport({ kind: 'file', filename: picked.name, content: picked.content }))
  if (!preview) return false

  const answer = await useUi.getState().confirm({
    title: 'Restaurar este backup',
    message: `Se reemplazará TODA tu biblioteca actual por el contenido de «${picked.name}» (${pluralize(preview.candidates.length, 'prompt', 'prompts')}). Antes se guarda una copia automática de seguridad.`,
    confirmLabel: 'Restaurar',
    danger: true,
  })
  if (answer !== 'confirm') return false

  const result = await attempt(async () => {
    const outcome = await api.restoreBackup(picked.content)
    await useLibrary.getState().load()
    return outcome
  })
  if (!result) return false
  useUi.getState().toast(`Biblioteca restaurada: ${pluralize(result.prompts, 'prompt', 'prompts')}`)
  for (const warning of result.warnings) useUi.getState().toast(warning, 'info')
  return true
}
