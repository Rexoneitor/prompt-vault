import { describe, expect, it } from 'vitest'
import { NO_FILTERS, selectPrompts, type Scope } from '../src/features/library/filtering'
import { splitCodeBlocks } from '../src/utils/blocks'
import { daysSince, relativeTime } from '../src/utils/date'
import { diffLines } from '../src/utils/diff'
import { applyPatch, insertCodeBlock, insertVariable, toggleBulletList } from '../src/utils/textarea'
import { buildSearchIndex } from '@shared/search'
import type { Prompt } from '@shared/types'

const make = (id: string, overrides: Partial<Prompt> = {}): Prompt => ({
  id,
  title: id,
  description: '',
  content: `contenido de ${id}`,
  notes: '',
  categoryId: null,
  projectId: null,
  toolId: 'general',
  tagIds: [],
  favorite: false,
  archived: false,
  isDemo: false,
  usageCount: 0,
  versionCount: 0,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  lastUsedAt: null,
  ...overrides,
})

const emptyContext = { categories: new Map(), projects: new Map(), tools: new Map(), tags: new Map() }

describe('filtrado y orden de la biblioteca', () => {
  const prompts = [
    make('a', { favorite: true, updatedAt: '2026-03-01T00:00:00Z', lastUsedAt: '2026-03-05T00:00:00Z', usageCount: 1, categoryId: 'c1' }),
    make('b', { updatedAt: '2026-04-01T00:00:00Z', lastUsedAt: '2026-02-01T00:00:00Z', usageCount: 9, tagIds: ['t1'] }),
    make('c', { archived: true, favorite: true }),
    make('d', { updatedAt: '2026-02-01T00:00:00Z', toolId: 'claude', projectId: 'p1' }),
  ]
  const index = buildSearchIndex(prompts, emptyContext)
  const ids = (scope: Scope, filters = NO_FILTERS, sort: 'modified' | 'used' | 'created' | 'title' | 'most-used' = 'modified') =>
    selectPrompts(prompts, scope, filters, sort, index).map((p) => p.id)

  it('excluye los archivados de todo salvo de «Archivados»', () => {
    expect(ids({ kind: 'all' })).toEqual(['b', 'a', 'd'])
    expect(ids({ kind: 'favorites' })).toEqual(['a'])
    expect(ids({ kind: 'archived' })).toEqual(['c'])
  })

  it('ordena por modificación, uso reciente, título y más usados', () => {
    expect(ids({ kind: 'all' }, NO_FILTERS, 'modified')).toEqual(['b', 'a', 'd'])
    expect(ids({ kind: 'all' }, NO_FILTERS, 'used')).toEqual(['a', 'b', 'd'])
    expect(ids({ kind: 'all' }, NO_FILTERS, 'title')).toEqual(['a', 'b', 'd'])
    expect(ids({ kind: 'all' }, NO_FILTERS, 'most-used')[0]).toBe('b')
  })

  it('«Recientes» solo incluye prompts usados y ordena por último uso', () => {
    expect(ids({ kind: 'recent' })).toEqual(['a', 'b'])
  })

  it('aplica ámbito de categoría, etiqueta y proyecto, y filtros combinados', () => {
    expect(ids({ kind: 'category', id: 'c1' })).toEqual(['a'])
    expect(ids({ kind: 'tag', id: 't1' })).toEqual(['b'])
    expect(ids({ kind: 'project', id: 'p1' })).toEqual(['d'])
    expect(ids({ kind: 'all' }, { ...NO_FILTERS, toolId: 'claude' })).toEqual(['d'])
    expect(ids({ kind: 'all' }, { ...NO_FILTERS, favoritesOnly: true })).toEqual(['a'])
    expect(ids({ kind: 'all' }, { ...NO_FILTERS, favoritesOnly: true, toolId: 'claude' })).toEqual([])
  })

  it('con búsqueda manda la relevancia y respeta el ámbito', () => {
    // «d» es subcadena de «contenido»: coinciden todos, pero el que contiene «de d» completo sube arriba.
    expect(ids({ kind: 'all' }, { ...NO_FILTERS, query: 'contenido de d' })[0]).toBe('d')
    expect(ids({ kind: 'all' }, { ...NO_FILTERS, query: 'prompt-inexistente' })).toEqual([])
    expect(ids({ kind: 'archived' }, { ...NO_FILTERS, query: 'contenido' })).toEqual(['c'])
    expect(ids({ kind: 'all' }, { ...NO_FILTERS, query: 'nada-que-coincida' })).toEqual([])
  })
})

describe('bloques de código', () => {
  it('separa texto y bloques con o sin lenguaje', () => {
    expect(splitCodeBlocks('Antes\n```js\nconsole.log(1)\n```\nDespués')).toEqual([
      { kind: 'text', text: 'Antes' },
      { kind: 'code', text: 'console.log(1)', lang: 'js' },
      { kind: 'text', text: 'Después' },
    ])
  })

  it('un bloque sin cerrar se queda como texto', () => {
    expect(splitCodeBlocks('Hola\n```\nsin cierre')).toEqual([{ kind: 'text', text: 'Hola\n```\nsin cierre' }])
  })

  it('respeta vallas más largas que contienen vallas cortas', () => {
    const blocks = splitCodeBlocks('````md\n```\ninterno\n```\n````')
    expect(blocks).toEqual([{ kind: 'code', text: '```\ninterno\n```', lang: 'md' }])
  })
})

describe('diff por líneas', () => {
  it('marca líneas añadidas, quitadas y comunes', () => {
    expect(diffLines('a\nb\nc', 'a\nx\nc')).toEqual([
      { type: 'same', text: 'a' },
      { type: 'del', text: 'b' },
      { type: 'add', text: 'x' },
      { type: 'same', text: 'c' },
    ])
  })

  it('textos idénticos no producen cambios', () => {
    expect(diffLines('uno\ndos', 'uno\ndos').every((line) => line.type === 'same')).toBe(true)
  })
})

describe('edición de texto (barra del editor)', () => {
  it('inserta una variable y deja el nombre seleccionado', () => {
    const patch = insertVariable({ value: 'Hola ', start: 5, end: 5 })
    const value = applyPatch('Hola ', patch)
    expect(value).toBe('Hola {{variable}}')
    expect(value.slice(patch.selectStart, patch.selectEnd)).toBe('variable')
  })

  it('convierte el texto seleccionado en variable, normalizando el nombre', () => {
    const patch = insertVariable({ value: 'Para mi audiencia final', start: 8, end: 23 })
    expect(applyPatch('Para mi audiencia final', patch)).toBe('Para mi {{audiencia_final}}')
  })

  it('envuelve la selección en un bloque de código', () => {
    const patch = insertCodeBlock({ value: 'a\ncódigo\nb', start: 2, end: 8 })
    expect(applyPatch('a\ncódigo\nb', patch)).toBe('a\n```\ncódigo\n```\nb')
  })

  it('alterna la lista con viñetas en las líneas seleccionadas', () => {
    const text = 'uno\ndos\ntres'
    const bulleted = applyPatch(text, toggleBulletList({ value: text, start: 0, end: text.length }))
    expect(bulleted).toBe('- uno\n- dos\n- tres')
    expect(applyPatch(bulleted, toggleBulletList({ value: bulleted, start: 0, end: bulleted.length }))).toBe(text)
  })
})

describe('fechas', () => {
  const now = Date.parse('2026-10-05T12:00:00Z')

  it('describe el tiempo transcurrido de forma compacta', () => {
    expect(relativeTime('2026-10-05T11:59:40Z', now)).toBe('ahora mismo')
    expect(relativeTime('2026-10-05T11:30:00Z', now)).toBe('hace 30 min')
    expect(relativeTime('2026-10-05T07:00:00Z', now)).toBe('hace 5 h')
    expect(relativeTime('2026-10-04T08:00:00Z', now)).toBe('ayer')
    expect(relativeTime(null, now)).toBe('nunca')
  })

  it('calcula días desde una fecha', () => {
    expect(daysSince('2026-09-28T12:00:00Z', now)).toBe(7)
    expect(daysSince(null, now)).toBeNull()
  })
})
