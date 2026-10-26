import { describe, expect, it } from 'vitest'
import { parseBackup } from '@shared/formats/backup'
import { parseCsv, toCsv } from '@shared/formats/csv'
import { promptsToMarkdown, type ResolvedPrompt } from '@shared/formats/export'
import { parseImport } from '@shared/formats/import'
import { buildSearchIndex, findMatchRanges, makeSnippet, searchPrompts } from '@shared/search'
import { deriveTitle, normalize } from '@shared/text'
import type { Category, Project, Prompt, Tag, Tool } from '@shared/types'
import { extractVariables, fillVariables, splitVariables } from '@shared/variables'
import { normalizeDraft } from '@shared/validation'

describe('variables', () => {
  it('extrae nombres únicos en orden de aparición', () => {
    expect(extractVariables('Hola {{ nombre }}, {{tema}} y otra vez {{nombre}}')).toEqual(['nombre', 'tema'])
  })

  it('admite acentos y guiones, e ignora llaves incompletas', () => {
    expect(extractVariables('{{audiencia-objetivo}} {{año}} {{ roto } {{}}')).toEqual(['audiencia-objetivo', 'año'])
  })

  it('rellena solo las variables con valor', () => {
    expect(fillVariables('A {{x}} B {{y}}', { x: '1', y: '' })).toBe('A 1 B {{y}}')
  })

  it('no reinterpreta el valor insertado', () => {
    expect(fillVariables('{{x}} {{y}}', { x: '{{y}}', y: 'Z' })).toBe('{{y}} Z')
  })

  it('divide en segmentos de texto y variable', () => {
    expect(splitVariables('a {{b}} c')).toEqual([
      { kind: 'text', text: 'a ' },
      { kind: 'variable', name: 'b', raw: '{{b}}' },
      { kind: 'text', text: ' c' },
    ])
  })
})

describe('texto', () => {
  it('normaliza sin acentos ni mayúsculas', () => {
    expect(normalize('Programación ÁÉÍ')).toBe('programacion aei')
  })

  it('deriva un título de la primera línea útil', () => {
    expect(deriveTitle('\n\n## Eres un experto en {{tema}}\nresto')).toBe('Eres un experto en tema')
  })
})

describe('validación', () => {
  const base = {
    title: '',
    description: '',
    content: 'x',
    notes: '',
    categoryId: null,
    projectId: null,
    toolId: 'general',
    tags: [],
    favorite: false,
  }

  it('rechaza un prompt vacío', () => {
    expect(() => normalizeDraft({ ...base, content: '   \n ' })).toThrow(/vacío/)
  })

  it('deriva el título si falta y limpia etiquetas duplicadas', () => {
    const result = normalizeDraft({ ...base, content: 'Resume este texto', tags: ['#IA', 'ia', ' Ía ', 'otra'] })
    expect(result.title).toBe('Resume este texto')
    expect(result.tags).toEqual(['IA', 'otra'])
  })
})

describe('búsqueda', () => {
  const now = '2026-01-01T00:00:00Z'
  const categories = new Map<string, Category>([
    ['c1', { id: 'c1', name: 'Marketing', color: 'rose', sortOrder: 0, createdAt: now, updatedAt: now }],
  ])
  const projects = new Map<string, Project>([
    ['p1', { id: 'p1', name: 'CRM Agencia', description: '', isDemo: false, createdAt: now, updatedAt: now }],
  ])
  const tools = new Map<string, Tool>([['claude', { id: 'claude', name: 'Claude', sortOrder: 0 }]])
  const tags = new Map<string, Tag>([['t1', { id: 't1', name: 'Instagram' }]])
  const make = (id: string, overrides: Partial<Prompt>): Prompt => ({
    id,
    title: id,
    description: '',
    content: '',
    notes: '',
    categoryId: null,
    projectId: null,
    toolId: 'claude',
    tagIds: [],
    favorite: false,
    archived: false,
    isDemo: false,
    usageCount: 0,
    versionCount: 0,
    createdAt: now,
    updatedAt: now,
    lastUsedAt: null,
    ...overrides,
  })
  const prompts = [
    make('a', { title: 'Estrategia de lanzamiento', categoryId: 'c1', tagIds: ['t1'] }),
    make('b', { title: 'Revisión de código', content: 'Analiza el código buscando fallos de seguridad en Instagram' }),
    make('c', { title: 'Otro', projectId: 'p1' }),
  ]
  const index = buildSearchIndex(prompts, { categories, projects, tools, tags })

  it('encuentra por etiqueta, categoría, proyecto y herramienta', () => {
    expect(searchPrompts(index, 'instagram').map((h) => h.id)).toEqual(['a', 'b'])
    expect(searchPrompts(index, 'marketing').map((h) => h.id)).toEqual(['a'])
    expect(searchPrompts(index, 'crm').map((h) => h.id)).toEqual(['c'])
    expect(searchPrompts(index, 'claude')).toHaveLength(3)
  })

  it('ignora acentos y exige todos los términos', () => {
    expect(searchPrompts(index, 'revision codigo').map((h) => h.id)).toEqual(['b'])
    expect(searchPrompts(index, 'revision marketing')).toEqual([])
  })

  it('prioriza el título sobre el contenido', () => {
    expect(searchPrompts(index, 'codigo')[0].id).toBe('b')
  })

  it('devuelve rangos sobre el texto original con acentos', () => {
    const [range] = findMatchRanges('Revisión de código', ['codigo'])
    expect('Revisión de código'.slice(range.start, range.end)).toBe('código')
  })

  it('genera un fragmento con la coincidencia', () => {
    const snippet = makeSnippet('x'.repeat(200) + ' seguridad ' + 'y'.repeat(200), ['seguridad'])
    expect(snippet?.text.startsWith('…')).toBe(true)
    const range = snippet!.ranges[0]
    expect(snippet!.text.slice(range.start, range.end)).toBe('seguridad')
  })
})

describe('CSV', () => {
  it('maneja comillas, saltos de línea y BOM', () => {
    const csv = toCsv([
      ['a', 'b'],
      ['linea 1\nlinea 2', 'dice "hola", ¿qué tal?'],
    ])
    expect(parseCsv(csv)).toEqual([
      ['a', 'b'],
      ['linea 1\nlinea 2', 'dice "hola", ¿qué tal?'],
    ])
  })

  it('detecta punto y coma como delimitador', () => {
    expect(parseCsv('a;b\n1;2')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ])
  })
})

describe('importación', () => {
  it('importa CSV con cabeceras en español', () => {
    const csv = 'Título,Prompt,Categoría,Etiquetas\nHola,Di hola a {{nombre}},Marketing,"a; b"\n,,,\nSin título,Texto suelto,,'
    const result = parseImport({ kind: 'file', filename: 'x.csv', content: csv })
    expect(result.drafts).toHaveLength(2)
    expect(result.drafts[0]).toMatchObject({ title: 'Hola', categoryName: 'Marketing', tags: ['a', 'b'] })
    expect(result.drafts[1].title).toBe('Sin título')
  })

  it('rechaza CSV sin columna de contenido', () => {
    expect(() => parseImport({ kind: 'file', filename: 'x.csv', content: 'a,b\n1,2' })).toThrow(/columna/)
  })

  it('importa listas JSON genéricas con alias', () => {
    const json = JSON.stringify([
      { titulo: 'T', prompt: 'P', etiquetas: 'x, y', favorito: 'sí' },
      { title: 'sin contenido' },
      'texto plano',
    ])
    const result = parseImport({ kind: 'file', filename: 'x.json', content: json })
    expect(result.drafts).toHaveLength(2)
    expect(result.skipped).toBe(1)
    expect(result.drafts[0]).toMatchObject({ title: 'T', content: 'P', tags: ['x', 'y'], favorite: true })
  })

  it('rechaza JSON dañado', () => {
    expect(() => parseImport({ kind: 'file', filename: 'x.json', content: '{ roto' })).toThrow(/JSON/)
  })

  it('el Markdown exportado se puede volver a importar (incluidas vallas dentro del contenido)', () => {
    const prompts: ResolvedPrompt[] = [
      {
        id: '1',
        title: 'Con código',
        description: 'desc',
        content: 'Escribe:\n```js\nconsole.log(1)\n```\nfin',
        notes: 'una nota\nde dos líneas',
        category: 'Programación',
        project: 'CRM',
        tool: 'Claude',
        tags: ['a', 'b'],
        favorite: true,
        archived: false,
        usageCount: 0,
        createdAt: '',
        updatedAt: '',
        lastUsedAt: null,
      },
      {
        id: '2',
        title: 'Simple',
        description: '',
        content: 'Hola {{x}}',
        notes: '',
        category: null,
        project: null,
        tool: 'General',
        tags: [],
        favorite: false,
        archived: false,
        usageCount: 0,
        createdAt: '',
        updatedAt: '',
        lastUsedAt: null,
      },
    ]
    const md = promptsToMarkdown(prompts, new Date('2026-01-01'))
    const { drafts } = parseImport({ kind: 'file', filename: 'x.md', content: md })
    expect(drafts).toHaveLength(2)
    expect(drafts[0]).toMatchObject({
      title: 'Con código',
      description: 'desc',
      content: prompts[0].content,
      notes: 'una nota\nde dos líneas',
      categoryName: 'Programación',
      projectName: 'CRM',
      toolName: 'Claude',
      tags: ['a', 'b'],
      favorite: true,
    })
    expect(drafts[1]).toMatchObject({ title: 'Simple', content: 'Hola {{x}}', categoryName: null })
  })

  it('un Markdown sin secciones es un único prompt', () => {
    const { drafts } = parseImport({ kind: 'file', filename: 'p.md', content: '# Mi prompt\n\nEres un experto.' })
    expect(drafts).toEqual([expect.objectContaining({ title: 'Mi prompt', content: 'Eres un experto.' })])
  })

  it('con asSingle no divide por títulos', () => {
    const { drafts } = parseImport({
      kind: 'file',
      filename: 'p.md',
      content: '# Prompt\n## Rol\nExperto\n## Tarea\nResumir',
      asSingle: true,
    })
    expect(drafts).toHaveLength(1)
    expect(drafts[0].content).toContain('## Tarea')
  })
})

describe('backup', () => {
  it('rechaza archivos que no son de Prompt Vault', () => {
    expect(() => parseBackup('{"hola": 1}')).toThrow(/no es un backup/)
  })

  it('rechaza estructuras corruptas indicando dónde', () => {
    const broken = JSON.stringify({ app: 'prompt-vault', formatVersion: 1, prompts: [{ id: 'x' }] })
    expect(() => parseBackup(broken)).toThrow(/prompts\[0\]\.content/)
  })

  it('rechaza backups de una versión de formato futura', () => {
    expect(() => parseBackup(JSON.stringify({ app: 'prompt-vault', formatVersion: 99 }))).toThrow(/más nueva/)
  })

  it('deja sin asignar las referencias rotas y avisa', () => {
    const file = JSON.stringify({
      app: 'prompt-vault',
      formatVersion: 1,
      prompts: [{ id: 'p', content: 'x', categoryId: 'no-existe', toolId: 'tampoco' }],
    })
    const { backup, warnings } = parseBackup(file)
    expect(backup.prompts[0]).toMatchObject({ categoryId: null, toolId: 'general' })
    expect(warnings).toHaveLength(1)
  })
})
