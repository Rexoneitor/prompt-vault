import { describe, expect, it } from 'vitest'
import { VaultError } from '@shared/errors'
import { VaultService } from '@backend/vault-service'
import { parseBackup } from '@shared/formats/backup'
import { createTestService, draft } from './helpers'

async function expectVaultError(promise: Promise<unknown>, code: string, message?: RegExp) {
  const error = await promise.then(
    () => null,
    (e: unknown) => e,
  )
  expect(error).toBeInstanceOf(VaultError)
  expect((error as VaultError).code).toBe(code)
  if (message) expect((error as VaultError).message).toMatch(message)
}

describe('datos iniciales', () => {
  it('crea las categorías y herramientas por defecto una sola vez', async () => {
    const { service } = createTestService()
    const library = await service.getLibrary()
    expect(library.categories.map((c) => c.name)).toContain('Programación')
    expect(library.categories).toHaveLength(15)
    expect(library.tools.map((t) => t.id)).toContain('general')
    expect(library.prompts).toEqual([])
  })
})

describe('prompts', () => {
  it('crea, lee y actualiza con etiquetas', async () => {
    const { service } = createTestService()
    const { prompt } = await service.createPrompt(draft({ title: 'Uno', tags: ['Ventas', 'ventas', 'Instagram'] }))
    expect(prompt.tagIds).toHaveLength(2)
    expect(prompt.lastUsedAt).not.toBeNull()

    const { prompt: updated, tags } = await service.updatePrompt(prompt.id, draft({ title: 'Uno bis', tags: ['Instagram'] }))
    expect(updated.title).toBe('Uno bis')
    expect(tags.map((t) => t.name)).toEqual(['Instagram']) // «Ventas» quedó huérfana y se limpió
  })

  it('rechaza prompts vacíos y referencias inexistentes', async () => {
    const { service } = createTestService()
    await expectVaultError(service.createPrompt(draft({ content: '  ' })), 'VALIDATION', /vacío/)
    await expectVaultError(service.createPrompt(draft({ categoryId: 'nope' })), 'VALIDATION', /categoría/)
    await expectVaultError(service.updatePrompt('nope', draft()), 'NOT_FOUND')
  })

  it('registra apertura (sin contar) y copia (contando)', async () => {
    const { service } = createTestService()
    const { prompt } = await service.createPrompt(draft())
    const opened = await service.recordOpen(prompt.id)
    expect(opened.usageCount).toBe(0)
    expect(opened.lastUsedAt! > prompt.lastUsedAt!).toBe(true)
    const copied = await service.recordCopy(prompt.id)
    expect(copied.usageCount).toBe(1)
    expect((await service.recordCopy(prompt.id)).usageCount).toBe(2)
  })

  it('favorito y archivado no modifican la fecha de edición', async () => {
    const { service } = createTestService()
    const { prompt } = await service.createPrompt(draft())
    const fav = await service.setFavorite(prompt.id, true)
    const [archived] = await service.setArchived([prompt.id], true)
    expect(fav.favorite).toBe(true)
    expect(archived.archived).toBe(true)
    expect(archived.updatedAt).toBe(prompt.updatedAt)
  })

  it('duplica como copia independiente', async () => {
    const { service } = createTestService()
    const { prompt } = await service.createPrompt(draft({ title: 'Original', tags: ['a'], favorite: true }))
    await service.recordCopy(prompt.id)
    const { prompt: copy } = await service.duplicatePrompt(prompt.id)
    expect(copy.id).not.toBe(prompt.id)
    expect(copy.title).toBe('Original (copia)')
    expect(copy).toMatchObject({ favorite: false, usageCount: 0, tagIds: prompt.tagIds })
    await service.updatePrompt(copy.id, draft({ title: 'Cambiado', content: 'otro' }))
    expect((await service.getLibrary()).prompts.find((p) => p.id === prompt.id)?.content).toBe('Contenido de prueba')
  })

  it('elimina prompts junto con sus versiones y etiquetas huérfanas', async () => {
    const { service } = createTestService()
    const { prompt } = await service.createPrompt(draft({ tags: ['solo-aqui'] }))
    await service.createVersion(prompt.id, {})
    const tags = await service.deletePrompts([prompt.id])
    expect(tags).toEqual([])
    expect((await service.getLibrary()).prompts).toEqual([])
  })
})

describe('taxonomía', () => {
  it('impide nombres repetidos ignorando acentos y mayúsculas', async () => {
    const { service } = createTestService()
    await expectVaultError(service.createCategory({ name: 'programacion', color: 'sky' }), 'CONFLICT', /Programación/)
    const project = await service.createProject({ name: 'CRM', description: '' })
    await expectVaultError(service.createProject({ name: ' crm ', description: '' }), 'CONFLICT')
    await expectVaultError(service.updateProject(project.id, { name: '', description: '' }), 'VALIDATION')
  })

  it('al eliminar una categoría o un proyecto los prompts quedan sin ellos', async () => {
    const { service } = createTestService()
    const category = await service.createCategory({ name: 'Nueva', color: 'sky' })
    const project = await service.createProject({ name: 'P', description: '' })
    const { prompt } = await service.createPrompt(draft({ categoryId: category.id, projectId: project.id }))
    await service.deleteCategory(category.id)
    await service.deleteProject(project.id)
    const after = (await service.getLibrary()).prompts[0]
    expect(after.id).toBe(prompt.id)
    expect(after).toMatchObject({ categoryId: null, projectId: null })
  })

  it('reordena categorías, aceptando listas parciales', async () => {
    const { service } = createTestService()
    const [first, second, third] = (await service.getLibrary()).categories
    const result = await service.reorderCategories([third.id, first.id])
    expect(result.slice(0, 3).map((c) => c.id)).toEqual([third.id, first.id, second.id])
  })

  it('fusiona etiquetas al renombrar a un nombre existente', async () => {
    const { service } = createTestService()
    const { prompt: a } = await service.createPrompt(draft({ tags: ['ig'] }))
    const { prompt: b, tags } = await service.createPrompt(draft({ tags: ['instagram'] }))
    const ig = tags.find((t) => t.name === 'ig')!
    const merged = await service.renameTag(ig.id, 'Instagram')
    expect(merged).toHaveLength(1)
    const library = await service.getLibrary()
    expect(library.prompts.find((p) => p.id === a.id)?.tagIds).toEqual([merged[0].id])
    expect(library.prompts.find((p) => p.id === b.id)?.tagIds).toEqual([merged[0].id])
  })

  it('las herramientas son ampliables y «General» es fija', async () => {
    const { service } = createTestService()
    const tool = await service.createTool({ name: 'Mi IA' })
    const { prompt } = await service.createPrompt(draft({ toolId: tool.id }))
    await expectVaultError(service.deleteTool('general'), 'VALIDATION')
    await service.deleteTool(tool.id)
    expect((await service.getLibrary()).prompts.find((p) => p.id === prompt.id)?.toolId).toBe('general')
  })
})

describe('versiones', () => {
  it('numera correlativamente (el siguiente es el mayor + 1)', async () => {
    const { service } = createTestService()
    const { prompt } = await service.createPrompt(draft({ content: 'v-uno' }))
    const { version: v1 } = await service.createVersion(prompt.id, { name: 'Inicial', notes: 'primera' })
    await service.updatePrompt(prompt.id, draft({ content: 'v-dos' }))
    const { version: v2, prompt: after } = await service.createVersion(prompt.id, {})
    expect([v1.version, v1.content, v1.name]).toEqual([1, 'v-uno', 'Inicial'])
    expect([v2.version, v2.content]).toEqual([2, 'v-dos'])
    expect(after.versionCount).toBe(2)
    const { version: v3 } = await service.createVersion(prompt.id, {})
    expect(v3.version).toBe(3)
    await service.deleteVersion(v2.id) // un hueco en medio se respeta
    expect((await service.createVersion(prompt.id, {})).version.version).toBe(4)
  })

  it('guarda la versión anterior al editar si se pide', async () => {
    const { service } = createTestService()
    const { prompt } = await service.createPrompt(draft({ content: 'antes' }))
    await service.updatePrompt(prompt.id, draft({ content: 'después' }), { snapshotPrevious: { notes: 'cambio de tono' } })
    const versions = await service.listVersions(prompt.id)
    expect(versions).toHaveLength(1)
    expect(versions[0]).toMatchObject({ content: 'antes', notes: 'cambio de tono' })
  })

  it('restaurar conserva antes el contenido actual y no pierde nada', async () => {
    const { service } = createTestService()
    const { prompt } = await service.createPrompt(draft({ content: 'original' }))
    const { version } = await service.createVersion(prompt.id, {})
    await service.updatePrompt(prompt.id, draft({ content: 'trabajo sin guardar' }))

    const restored = await service.restoreVersion(version.id)
    expect(restored.content).toBe('original')
    const versions = await service.listVersions(prompt.id)
    expect(versions.map((v) => v.content)).toEqual(['trabajo sin guardar', 'original'])
    expect(versions[0].name).toMatch(/Antes de restaurar v1/)

    // Restaurar de nuevo con el contenido ya guardado no duplica versiones.
    await service.restoreVersion(version.id)
    expect(await service.listVersions(prompt.id)).toHaveLength(2)
  })
})

describe('exportar e importar', () => {
  async function seeded() {
    const ctx = createTestService()
    const category = (await ctx.service.getLibrary()).categories.find((c) => c.name === 'Marketing')!
    const project = await ctx.service.createProject({ name: 'Papelería', description: 'desc' })
    const a = await ctx.service.createPrompt(
      draft({
        title: 'A',
        content: 'Hola {{x}}',
        categoryId: category.id,
        projectId: project.id,
        toolId: 'claude',
        tags: ['uno', 'dos'],
        favorite: true,
      }),
    )
    const b = await ctx.service.createPrompt(draft({ title: 'B, con "comillas"', content: 'línea 1\nlínea 2', notes: 'nota' }))
    await ctx.service.createVersion(a.prompt.id, { name: 'v1', notes: 'n' })
    await ctx.service.recordCopy(a.prompt.id)
    return { ...ctx, a: a.prompt, b: b.prompt }
  }

  it('exporta en los cuatro formatos, todo o selección', async () => {
    const { service, a } = await seeded()
    const json = await service.exportLibrary({ format: 'json' })
    expect(json.filename).toMatch(/^prompt-vault-export-\d{4}-\d{2}-\d{2}\.json$/)
    expect(json.count).toBe(2)
    const csv = await service.exportLibrary({ format: 'csv' })
    expect(csv.content.startsWith('﻿title,')).toBe(true)
    expect(csv.content).toContain('"B, con ""comillas"""')
    const md = await service.exportLibrary({ format: 'markdown', ids: [a.id] })
    expect(md.count).toBe(1)
    expect(md.content).toContain('## A')
    expect((await service.exportLibrary({ format: 'txt' })).content).toContain('Hola {{x}}')
    await expectVaultError(service.exportLibrary({ format: 'csv', ids: ['nada'] }), 'VALIDATION')
  })

  it('backup → restaurar en otra biblioteca reproduce todo con ids, versiones y uso', async () => {
    const source = await seeded()
    const backup = await source.service.createBackup()
    expect(backup.filename).toMatch(/^prompt-vault-backup-/)
    expect((await source.service.getLibrary()).settings.lastBackupAt).toBeNull() // aún no se ha guardado
    await source.service.recordBackup()
    expect((await source.service.getLibrary()).settings.lastBackupAt).not.toBeNull()

    const target = createTestService()
    await target.service.createPrompt(draft({ title: 'Se perderá' }))
    const result = await target.service.restoreBackup(backup.content)
    expect(result.prompts).toBe(2)

    const original = await source.service.getLibrary()
    const restored = await target.service.getLibrary()
    expect(restored.prompts.map((p) => p.id).sort()).toEqual(original.prompts.map((p) => p.id).sort())
    const a = restored.prompts.find((p) => p.id === source.a.id)!
    expect(a).toMatchObject({ title: 'A', usageCount: 1, versionCount: 1, favorite: true, toolId: 'claude' })
    expect(restored.categories.map((c) => c.id)).toEqual(original.categories.map((c) => c.id))
    expect(restored.tags.map((t) => t.name).sort()).toEqual(['dos', 'uno'])
  })

  it('un backup corrupto no toca los datos existentes', async () => {
    const { service } = createTestService()
    await service.createPrompt(draft({ title: 'Intacto' }))
    await expectVaultError(service.restoreBackup('{ esto no es json'), 'BACKUP_INVALID')
    await expectVaultError(
      service.restoreBackup(JSON.stringify({ app: 'prompt-vault', formatVersion: 1, prompts: [{ id: 'x' }] })),
      'BACKUP_INVALID',
    )
    expect((await service.getLibrary()).prompts.map((p) => p.title)).toEqual(['Intacto'])
  })

  it('un fallo a mitad de la restauración deshace todo (transacción atómica)', async () => {
    const { db, service } = createTestService()
    await service.createPrompt(draft({ title: 'Intacto', tags: ['t'] }))

    // Un servicio sobre la misma base cuyo generador de ids falla al crear etiquetas, ya dentro de la transacción.
    const failing = new VaultService(db, {
      newId: () => {
        throw new Error('fallo simulado')
      },
    })
    const backup = JSON.stringify({
      app: 'prompt-vault',
      formatVersion: 1,
      prompts: [{ id: 'p1', title: 'x', content: 'c', tags: ['nueva'] }],
    })
    await expect(failing.restoreBackup(backup)).rejects.toThrow('fallo simulado')

    const library = await service.getLibrary()
    expect(library.prompts.map((p) => p.title)).toEqual(['Intacto'])
    expect(library.categories).toHaveLength(15)
  })

  it('importa fusionando: crea categorías/proyectos/herramientas nuevas y marca duplicados', async () => {
    const source = await seeded()
    const backup = await source.service.createBackup()

    const target = createTestService()
    const preview = await target.service.previewImport({ kind: 'file', filename: 'b.json', content: backup.content })
    expect(preview.source).toBe('json')
    expect(preview.candidates.map((c) => c.status)).toEqual(['new', 'new'])
    const result = await target.service.commitImport(preview.candidates)
    expect(result.imported).toBe(2)

    const library = await target.service.getLibrary()
    const imported = library.prompts.find((p) => p.title === 'A')!
    expect(imported.versionCount).toBe(1)
    expect(imported.usageCount).toBe(0)
    expect(library.projects.map((p) => p.name)).toEqual(['Papelería'])
    expect(library.categories.filter((c) => c.name === 'Marketing')).toHaveLength(1) // reutiliza la existente

    const again = await target.service.previewImport({ kind: 'file', filename: 'b.json', content: backup.content })
    expect(again.candidates.map((c) => c.status)).toEqual(['duplicate', 'duplicate'])
  })

  it('el export CSV se reimporta con sus campos', async () => {
    const { service } = await seeded()
    const csv = await service.exportLibrary({ format: 'csv' })
    const fresh = createTestService()
    const preview = await fresh.service.previewImport({ kind: 'file', filename: 'x.csv', content: csv.content })
    const a = preview.candidates.find((c) => c.title === 'A')!
    expect(a).toMatchObject({ categoryName: 'Marketing', toolName: 'Claude', tags: ['uno', 'dos'], favorite: true, content: 'Hola {{x}}' })
    const b = preview.candidates.find((c) => c.title.startsWith('B'))!
    expect(b.content).toBe('línea 1\nlínea 2')
  })

  it('importa texto pegado y detecta repetidos dentro del mismo archivo', async () => {
    const { service } = createTestService()
    const json = JSON.stringify([
      { title: 'a', content: 'mismo contenido' },
      { title: 'b', content: 'mismo   contenido' },
    ])
    const preview = await service.previewImport({ kind: 'file', filename: 'x.json', content: json })
    expect(preview.candidates.map((c) => c.status)).toEqual(['new', 'duplicate'])
    await expectVaultError(service.previewImport({ kind: 'text', content: '   ' }), 'IMPORT_INVALID')
  })
})

describe('datos de demostración', () => {
  it('se cargan una vez, se identifican y se eliminan sin tocar datos reales', async () => {
    const { service } = createTestService()
    await service.createPrompt(draft({ title: 'Real', tags: ['mia'] }))
    expect(await service.loadDemoData()).toBeGreaterThan(5)
    expect(await service.loadDemoData()).toBe(0)

    let library = await service.getLibrary()
    const demos = library.prompts.filter((p) => p.isDemo)
    expect(demos.length).toBe(library.prompts.length - 1)
    expect(library.projects.every((p) => p.isDemo)).toBe(true)

    // Editar un prompt de demo lo convierte en un dato propio.
    const adopted = demos[0]
    await service.updatePrompt(adopted.id, draft({ title: 'Adoptado', content: 'mío ahora' }))

    const removed = await service.removeDemoData()
    expect(removed).toBe(demos.length - 1)
    library = await service.getLibrary()
    expect(library.prompts.map((p) => p.title).sort()).toEqual(['Adoptado', 'Real'])
    expect(library.tags.map((t) => t.name)).toEqual(['mia'])
    expect(library.projects).toEqual([])
  })
})

describe('copia de seguridad previa a restaurar', () => {
  it('se solicita antes de modificar datos y no si el backup es inválido', async () => {
    const calls: string[] = []
    const { service } = createTestService({ safetySnapshot: (reason) => calls.push(reason) })
    const backup = parseBackup(JSON.stringify({ app: 'prompt-vault', formatVersion: 1, prompts: [] }))
    expect(backup.backup.prompts).toEqual([])
    await expectVaultError(service.restoreBackup('basura'), 'BACKUP_INVALID')
    expect(calls).toEqual([])
    await service.restoreBackup(JSON.stringify({ app: 'prompt-vault', formatVersion: 1, prompts: [] }))
    expect(calls).toEqual(['restore'])
  })
})
