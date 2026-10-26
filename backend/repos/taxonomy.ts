import { VaultError } from '@shared/errors'
import { nameKey } from '@shared/text'
import { GENERAL_TOOL_ID, type Category, type Id, type Project, type Tag, type Tool } from '@shared/types'
import { all, flag, one, run, type Db } from '../db'

/** Comprueba unicidad de nombre ignorando mayúsculas y acentos (SQLite solo lo hace para ASCII). */
function assertNameFree(db: Db, table: string, name: string, label: string, exceptId?: Id): void {
  const key = nameKey(name)
  const rows = all<{ id: Id; name: string }>(db, `SELECT id, name FROM ${table}`)
  const clash = rows.find((row) => row.id !== exceptId && nameKey(row.name) === key)
  if (clash) throw new VaultError('CONFLICT', `Ya existe ${label} llamada «${clash.name}».`)
}

function notFound(label: string): never {
  throw new VaultError('NOT_FOUND', `${label} no existe (puede haberse eliminado).`)
}

/* -------------------------------- Categorías -------------------------------- */

interface CategoryRow {
  id: Id
  name: string
  color: string
  sort_order: number
  created_at: string
  updated_at: string
}

const toCategory = (row: CategoryRow): Category => ({
  id: row.id,
  name: row.name,
  color: row.color,
  sortOrder: row.sort_order,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
})

export class CategoryRepo {
  constructor(private readonly db: Db) {}

  list(): Category[] {
    return all<CategoryRow>(this.db, 'SELECT * FROM categories ORDER BY sort_order, name COLLATE NOCASE').map(toCategory)
  }

  get(id: Id): Category | null {
    const row = one<CategoryRow>(this.db, 'SELECT * FROM categories WHERE id = ?', id)
    return row ? toCategory(row) : null
  }

  findByName(name: string): Category | null {
    const key = nameKey(name)
    return this.list().find((category) => nameKey(category.name) === key) ?? null
  }

  insert(category: Omit<Category, 'sortOrder'> & { sortOrder?: number }): Category {
    assertNameFree(this.db, 'categories', category.name, 'una categoría')
    const sortOrder =
      category.sortOrder ?? one<{ next: number }>(this.db, 'SELECT COALESCE(MAX(sort_order), -1) + 1 AS next FROM categories')?.next ?? 0
    run(
      this.db,
      'INSERT INTO categories (id, name, color, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
      category.id,
      category.name,
      category.color,
      sortOrder,
      category.createdAt,
      category.updatedAt,
    )
    return { ...category, sortOrder }
  }

  update(id: Id, name: string, color: string, updatedAt: string): Category {
    if (!this.get(id)) notFound('La categoría')
    assertNameFree(this.db, 'categories', name, 'una categoría', id)
    run(this.db, 'UPDATE categories SET name = ?, color = ?, updated_at = ? WHERE id = ?', name, color, updatedAt, id)
    return this.get(id)!
  }

  delete(id: Id): void {
    if (run(this.db, 'DELETE FROM categories WHERE id = ?', id) === 0) notFound('La categoría')
  }

  reorder(ids: readonly Id[]): void {
    ids.forEach((id, index) => run(this.db, 'UPDATE categories SET sort_order = ? WHERE id = ?', index, id))
  }
}

/* --------------------------------- Proyectos --------------------------------- */

interface ProjectRow {
  id: Id
  name: string
  description: string
  is_demo: number
  created_at: string
  updated_at: string
}

const toProject = (row: ProjectRow): Project => ({
  id: row.id,
  name: row.name,
  description: row.description,
  isDemo: row.is_demo === 1,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
})

export class ProjectRepo {
  constructor(private readonly db: Db) {}

  list(): Project[] {
    return all<ProjectRow>(this.db, 'SELECT * FROM projects ORDER BY name COLLATE NOCASE').map(toProject)
  }

  get(id: Id): Project | null {
    const row = one<ProjectRow>(this.db, 'SELECT * FROM projects WHERE id = ?', id)
    return row ? toProject(row) : null
  }

  findByName(name: string): Project | null {
    const key = nameKey(name)
    return this.list().find((project) => nameKey(project.name) === key) ?? null
  }

  insert(project: Project): Project {
    assertNameFree(this.db, 'projects', project.name, 'un proyecto')
    run(
      this.db,
      'INSERT INTO projects (id, name, description, is_demo, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
      project.id,
      project.name,
      project.description,
      flag(project.isDemo),
      project.createdAt,
      project.updatedAt,
    )
    return project
  }

  update(id: Id, name: string, description: string, updatedAt: string): Project {
    if (!this.get(id)) notFound('El proyecto')
    assertNameFree(this.db, 'projects', name, 'un proyecto', id)
    run(
      this.db,
      'UPDATE projects SET name = ?, description = ?, is_demo = 0, updated_at = ? WHERE id = ?',
      name,
      description,
      updatedAt,
      id,
    )
    return this.get(id)!
  }

  delete(id: Id): void {
    if (run(this.db, 'DELETE FROM projects WHERE id = ?', id) === 0) notFound('El proyecto')
  }

  /** Elimina los proyectos de demostración que ya no tienen prompts. */
  deleteEmptyDemo(): void {
    run(this.db, 'DELETE FROM projects WHERE is_demo = 1 AND id NOT IN (SELECT project_id FROM prompts WHERE project_id IS NOT NULL)')
  }
}

/* --------------------------------- Etiquetas --------------------------------- */

interface TagRow {
  id: Id
  name: string
}

export class TagRepo {
  constructor(private readonly db: Db) {}

  list(): Tag[] {
    return all<TagRow>(this.db, 'SELECT id, name FROM tags ORDER BY name COLLATE NOCASE')
  }

  /** Devuelve el id de la etiqueta con ese nombre; la crea si no existe. */
  getOrCreate(name: string, id: Id, createdAt: string): Id {
    const key = nameKey(name)
    const existing = this.list().find((tag) => nameKey(tag.name) === key)
    if (existing) return existing.id
    run(this.db, 'INSERT INTO tags (id, name, created_at) VALUES (?, ?, ?)', id, name, createdAt)
    return id
  }

  /** Renombra; si el nombre ya pertenece a otra etiqueta, fusiona en ella. */
  rename(id: Id, name: string): void {
    const current = one<TagRow>(this.db, 'SELECT id, name FROM tags WHERE id = ?', id)
    if (!current) notFound('La etiqueta')
    const key = nameKey(name)
    const target = this.list().find((tag) => tag.id !== id && nameKey(tag.name) === key)
    if (!target) {
      run(this.db, 'UPDATE tags SET name = ? WHERE id = ?', name, id)
      return
    }
    run(
      this.db,
      'INSERT OR IGNORE INTO prompt_tags (prompt_id, tag_id) SELECT prompt_id, ? FROM prompt_tags WHERE tag_id = ?',
      target.id,
      id,
    )
    run(this.db, 'DELETE FROM tags WHERE id = ?', id)
  }

  delete(id: Id): void {
    if (run(this.db, 'DELETE FROM tags WHERE id = ?', id) === 0) notFound('La etiqueta')
  }

  deleteOrphans(): void {
    run(this.db, 'DELETE FROM tags WHERE id NOT IN (SELECT tag_id FROM prompt_tags)')
  }

  idsFor(promptId: Id): Id[] {
    return all<{ tag_id: Id }>(this.db, 'SELECT tag_id FROM prompt_tags WHERE prompt_id = ?', promptId).map((row) => row.tag_id)
  }

  replaceFor(promptId: Id, tagIds: readonly Id[]): void {
    run(this.db, 'DELETE FROM prompt_tags WHERE prompt_id = ?', promptId)
    for (const tagId of tagIds) run(this.db, 'INSERT OR IGNORE INTO prompt_tags (prompt_id, tag_id) VALUES (?, ?)', promptId, tagId)
  }
}

/* ------------------------------- Herramientas ------------------------------- */

interface ToolRow {
  id: Id
  name: string
  sort_order: number
}

const toTool = (row: ToolRow): Tool => ({ id: row.id, name: row.name, sortOrder: row.sort_order })

export class ToolRepo {
  constructor(private readonly db: Db) {}

  list(): Tool[] {
    return all<ToolRow>(this.db, 'SELECT id, name, sort_order FROM tools ORDER BY sort_order, name COLLATE NOCASE').map(toTool)
  }

  get(id: Id): Tool | null {
    const row = one<ToolRow>(this.db, 'SELECT id, name, sort_order FROM tools WHERE id = ?', id)
    return row ? toTool(row) : null
  }

  findByName(name: string): Tool | null {
    const key = nameKey(name)
    return this.list().find((tool) => nameKey(tool.name) === key) ?? null
  }

  insert(tool: Tool, now: string): Tool {
    assertNameFree(this.db, 'tools', tool.name, 'una herramienta')
    run(
      this.db,
      'INSERT INTO tools (id, name, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
      tool.id,
      tool.name,
      tool.sortOrder,
      now,
      now,
    )
    return tool
  }

  nextSortOrder(): number {
    return one<{ next: number }>(this.db, 'SELECT COALESCE(MAX(sort_order), -1) + 1 AS next FROM tools')?.next ?? 0
  }

  update(id: Id, name: string, updatedAt: string): Tool {
    if (!this.get(id)) notFound('La herramienta')
    assertNameFree(this.db, 'tools', name, 'una herramienta', id)
    run(this.db, 'UPDATE tools SET name = ?, updated_at = ? WHERE id = ?', name, updatedAt, id)
    return this.get(id)!
  }

  /** Los prompts de la herramienta eliminada pasan a «General». */
  delete(id: Id): void {
    if (id === GENERAL_TOOL_ID) throw new VaultError('VALIDATION', '«General» es una herramienta fija y no se puede eliminar.')
    if (!this.get(id)) notFound('La herramienta')
    run(this.db, 'UPDATE prompts SET tool_id = ? WHERE tool_id = ?', GENERAL_TOOL_ID, id)
    run(this.db, 'DELETE FROM tools WHERE id = ?', id)
  }
}
