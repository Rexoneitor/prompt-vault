import { useMemo, useState, type DragEvent, type KeyboardEvent, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Check, GripVertical, Pencil, Plus, Trash2, X } from 'lucide-react'
import { Button, IconButton } from '@/components/Button'
import { ColorDot } from '@/components/ColorDot'
import { EmptyState } from '@/components/EmptyState'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useLibrary } from '@/store/library'
import { attempt, useUi } from '@/store/ui'
import { GENERAL_TOOL_ID } from '@shared/types'
import { nameKey, pluralize } from '@shared/text'

type Tab = 'categories' | 'projects' | 'tags' | 'tools'

const TABS: { id: Tab; label: string }[] = [
  { id: 'categories', label: 'Categorías' },
  { id: 'projects', label: 'Proyectos' },
  { id: 'tags', label: 'Etiquetas' },
  { id: 'tools', label: 'Herramientas' },
]

function useCounts() {
  const prompts = useLibrary((s) => s.prompts)
  return useMemo(() => {
    const category = new Map<string, number>()
    const project = new Map<string, number>()
    const tag = new Map<string, number>()
    const tool = new Map<string, number>()
    const bump = (map: Map<string, number>, key: string | null) => key && map.set(key, (map.get(key) ?? 0) + 1)
    for (const p of prompts) {
      bump(category, p.categoryId)
      bump(project, p.projectId)
      bump(tool, p.toolId)
      p.tagIds.forEach((id) => bump(tag, id))
    }
    return { category, project, tag, tool }
  }, [prompts])
}

interface RowProps {
  lead?: ReactNode
  name: ReactNode
  detail?: string
  count: number
  to?: string
  actions: ReactNode
  dragProps?: React.HTMLAttributes<HTMLLIElement>
  className?: string
}

function ManageRow({ lead, name, detail, count, to, actions, dragProps, className }: RowProps) {
  return (
    <li className={`manage-row${className ? ` ${className}` : ''}`} {...dragProps}>
      {lead}
      <div className="manage-row-main">
        <span className="manage-row-name truncate">{to ? <Link to={to}>{name}</Link> : name}</span>
        {detail && <span className="manage-row-detail truncate">{detail}</span>}
      </div>
      <span className="manage-row-count">{pluralize(count, 'prompt', 'prompts')}</span>
      <div className="manage-row-actions">{actions}</div>
    </li>
  )
}

/* -------------------------------- Categorías -------------------------------- */

function CategoriesTab() {
  const categories = useLibrary((s) => s.categories)
  const counts = useCounts()
  const openDialog = useUi((s) => s.openDialog)
  const [dragId, setDragId] = useState<string | null>(null)
  const [overId, setOverId] = useState<string | null>(null)

  const move = (id: string, targetId: string) => {
    if (id === targetId) return
    const ids = categories.map((c) => c.id).filter((value) => value !== id)
    ids.splice(ids.indexOf(targetId), 0, id)
    void attempt(() => useLibrary.getState().reorderCategories(ids))
  }

  const moveBy = (id: string, delta: number) => {
    const ids = categories.map((c) => c.id)
    const from = ids.indexOf(id)
    const to = from + delta
    if (to < 0 || to >= ids.length) return
    ids.splice(to, 0, ...ids.splice(from, 1))
    void attempt(() => useLibrary.getState().reorderCategories(ids))
  }

  const remove = async (id: string, name: string) => {
    const affected = counts.category.get(id) ?? 0
    const answer = await useUi.getState().confirm({
      title: `Eliminar la categoría «${name}»`,
      message:
        affected > 0
          ? `${pluralize(affected, 'prompt quedará', 'prompts quedarán')} sin categoría. Los prompts no se borran.`
          : 'No tiene prompts asignados.',
      confirmLabel: 'Eliminar categoría',
      danger: true,
    })
    if (answer === 'confirm') await attempt(() => useLibrary.getState().deleteCategory(id), 'Categoría eliminada')
  }

  if (categories.length === 0) {
    return (
      <EmptyState
        compact
        icon={<Plus size={22} />}
        title="Sin categorías"
        message="Crea la primera para empezar a organizar tus prompts."
        actions={
          <Button variant="primary" onClick={() => openDialog({ type: 'category' })}>
            Nueva categoría
          </Button>
        }
      />
    )
  }

  return (
    <ul className="manage-list">
      {categories.map((category) => (
        <ManageRow
          key={category.id}
          className={`${dragId === category.id ? 'is-dragging' : ''}${overId === category.id && dragId !== category.id ? ' is-drop-target' : ''}`}
          lead={
            <>
              <button
                type="button"
                className="drag-handle"
                aria-label={`Reordenar ${category.name}: arrastra, o usa las flechas arriba y abajo`}
                onKeyDown={(event: KeyboardEvent) => {
                  if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
                    event.preventDefault()
                    moveBy(category.id, event.key === 'ArrowUp' ? -1 : 1)
                  }
                }}
              >
                <GripVertical size={16} />
              </button>
              <ColorDot color={category.color} size={11} />
            </>
          }
          name={category.name}
          count={counts.category.get(category.id) ?? 0}
          to={`/category/${category.id}`}
          dragProps={{
            draggable: true,
            onDragStart: (event: DragEvent) => {
              setDragId(category.id)
              event.dataTransfer.effectAllowed = 'move'
            },
            onDragOver: (event: DragEvent) => {
              if (!dragId) return
              event.preventDefault()
              setOverId(category.id)
            },
            onDrop: (event: DragEvent) => {
              event.preventDefault()
              if (dragId) move(dragId, category.id)
              setDragId(null)
              setOverId(null)
            },
            onDragEnd: () => {
              setDragId(null)
              setOverId(null)
            },
          }}
          actions={
            <>
              <IconButton label="Editar" size="sm" onClick={() => openDialog({ type: 'category', id: category.id })}>
                <Pencil size={15} />
              </IconButton>
              <IconButton label="Eliminar" size="sm" onClick={() => void remove(category.id, category.name)}>
                <Trash2 size={15} />
              </IconButton>
            </>
          }
        />
      ))}
    </ul>
  )
}

/* ---------------------------------- Proyectos ---------------------------------- */

function ProjectsTab() {
  const projects = useLibrary((s) => s.projects)
  const counts = useCounts()
  const openDialog = useUi((s) => s.openDialog)

  const remove = async (id: string, name: string) => {
    const affected = counts.project.get(id) ?? 0
    const answer = await useUi.getState().confirm({
      title: `Eliminar el proyecto «${name}»`,
      message:
        affected > 0
          ? `${pluralize(affected, 'prompt quedará', 'prompts quedarán')} sin proyecto. Los prompts no se borran.`
          : 'No tiene prompts asignados.',
      confirmLabel: 'Eliminar proyecto',
      danger: true,
    })
    if (answer === 'confirm') await attempt(() => useLibrary.getState().deleteProject(id), 'Proyecto eliminado')
  }

  if (projects.length === 0) {
    return (
      <EmptyState
        compact
        icon={<Plus size={22} />}
        title="Sin proyectos"
        message="Un proyecto reúne los prompts de un trabajo concreto, sea cual sea su categoría."
        actions={
          <Button variant="primary" onClick={() => openDialog({ type: 'project' })}>
            Nuevo proyecto
          </Button>
        }
      />
    )
  }

  return (
    <ul className="manage-list">
      {projects.map((project) => (
        <ManageRow
          key={project.id}
          lead={<span className="nav-hash manage-hash">▸</span>}
          name={project.name}
          detail={project.description || undefined}
          count={counts.project.get(project.id) ?? 0}
          to={`/project/${project.id}`}
          actions={
            <>
              <IconButton label="Editar" size="sm" onClick={() => openDialog({ type: 'project', id: project.id })}>
                <Pencil size={15} />
              </IconButton>
              <IconButton label="Eliminar" size="sm" onClick={() => void remove(project.id, project.name)}>
                <Trash2 size={15} />
              </IconButton>
            </>
          }
        />
      ))}
    </ul>
  )
}

/* ---------------------------------- Etiquetas ---------------------------------- */

function TagsTab() {
  const tags = useLibrary((s) => s.tags)
  const counts = useCounts()
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null)

  const sorted = useMemo(
    () => [...tags].sort((a, b) => (counts.tag.get(b.id) ?? 0) - (counts.tag.get(a.id) ?? 0) || a.name.localeCompare(b.name, 'es')),
    [tags, counts.tag],
  )

  const commit = async () => {
    if (!editing) return
    const current = tags.find((t) => t.id === editing.id)
    const name = editing.name.trim()
    if (!current || name === current.name) return setEditing(null)
    const clash = tags.find((t) => t.id !== editing.id && nameKey(t.name) === nameKey(name))
    if (clash) {
      const answer = await useUi.getState().confirm({
        title: 'Fusionar etiquetas',
        message: `Ya existe «${clash.name}». Los prompts con «${current.name}» pasarán a usar «${clash.name}».`,
        confirmLabel: 'Fusionar',
      })
      if (answer !== 'confirm') return
    }
    const done = await attempt(
      async () => {
        await useLibrary.getState().renameTag(editing.id, name)
        return true
      },
      clash ? 'Etiquetas fusionadas' : 'Etiqueta renombrada',
    )
    if (done) setEditing(null)
  }

  const remove = async (id: string, name: string) => {
    const affected = counts.tag.get(id) ?? 0
    const answer = await useUi.getState().confirm({
      title: `Eliminar la etiqueta «${name}»`,
      message: `Se quitará de ${pluralize(affected, 'prompt', 'prompts')}. Los prompts no se borran.`,
      confirmLabel: 'Eliminar etiqueta',
      danger: true,
    })
    if (answer === 'confirm') await attempt(() => useLibrary.getState().deleteTag(id), 'Etiqueta eliminada')
  }

  if (tags.length === 0) {
    return (
      <EmptyState
        compact
        icon={<Plus size={22} />}
        title="Sin etiquetas"
        message="Las etiquetas nacen al escribirlas en un prompt: crea o edita uno y añade las que quieras."
      />
    )
  }

  return (
    <ul className="manage-list">
      {sorted.map((tag) => (
        <ManageRow
          key={tag.id}
          lead={<span className="nav-hash manage-hash">#</span>}
          name={
            editing?.id === tag.id ? (
              <input
                className="input input-inline"
                autoFocus
                value={editing.name}
                maxLength={40}
                aria-label="Nombre de la etiqueta"
                onChange={(e) => setEditing({ id: tag.id, name: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void commit()
                  if (e.key === 'Escape') setEditing(null)
                }}
              />
            ) : (
              tag.name
            )
          }
          count={counts.tag.get(tag.id) ?? 0}
          to={editing?.id === tag.id ? undefined : `/tag/${tag.id}`}
          actions={
            editing?.id === tag.id ? (
              <>
                <IconButton label="Guardar" size="sm" onClick={() => void commit()}>
                  <Check size={15} />
                </IconButton>
                <IconButton label="Cancelar" size="sm" onClick={() => setEditing(null)}>
                  <X size={15} />
                </IconButton>
              </>
            ) : (
              <>
                <IconButton label="Renombrar" size="sm" onClick={() => setEditing({ id: tag.id, name: tag.name })}>
                  <Pencil size={15} />
                </IconButton>
                <IconButton label="Eliminar" size="sm" onClick={() => void remove(tag.id, tag.name)}>
                  <Trash2 size={15} />
                </IconButton>
              </>
            )
          }
        />
      ))}
    </ul>
  )
}

/* -------------------------------- Herramientas -------------------------------- */

function ToolsTab() {
  const tools = useLibrary((s) => s.tools)
  const counts = useCounts()
  const openDialog = useUi((s) => s.openDialog)

  const remove = async (id: string, name: string) => {
    const affected = counts.tool.get(id) ?? 0
    const answer = await useUi.getState().confirm({
      title: `Eliminar la herramienta «${name}»`,
      message:
        affected > 0
          ? `${pluralize(affected, 'prompt pasará', 'prompts pasarán')} a «General». Los prompts no se borran.`
          : 'No tiene prompts asignados.',
      confirmLabel: 'Eliminar herramienta',
      danger: true,
    })
    if (answer === 'confirm') await attempt(() => useLibrary.getState().deleteTool(id), 'Herramienta eliminada')
  }

  return (
    <ul className="manage-list">
      {tools.map((tool) => (
        <ManageRow
          key={tool.id}
          lead={<span className="tool-badge manage-tool">IA</span>}
          name={tool.name}
          detail={tool.id === GENERAL_TOOL_ID ? 'Para prompts que funcionan en varias herramientas. No se puede eliminar.' : undefined}
          count={counts.tool.get(tool.id) ?? 0}
          to={`/library?tool=${tool.id}`}
          actions={
            <>
              <IconButton label="Editar" size="sm" onClick={() => openDialog({ type: 'tool', id: tool.id })}>
                <Pencil size={15} />
              </IconButton>
              {tool.id !== GENERAL_TOOL_ID && (
                <IconButton label="Eliminar" size="sm" onClick={() => void remove(tool.id, tool.name)}>
                  <Trash2 size={15} />
                </IconButton>
              )}
            </>
          }
        />
      ))}
    </ul>
  )
}

/* ------------------------------------ Página ------------------------------------ */

export function OrganizePage() {
  useDocumentTitle('Organizar')
  const [params, setParams] = useSearchParams()
  const openDialog = useUi((s) => s.openDialog)
  const requested = params.get('tab')
  const tab: Tab = TABS.some((t) => t.id === requested) ? (requested as Tab) : 'categories'

  const addLabel = { categories: 'Nueva categoría', projects: 'Nuevo proyecto', tools: 'Nueva herramienta', tags: null }[tab]
  const addDialog = { categories: 'category', projects: 'project', tools: 'tool' } as const

  return (
    <div className="page page-narrow">
      <header className="page-header">
        <div className="page-heading">
          <h1 className="page-title serif">Organizar</h1>
          <p className="page-subtitle">Categorías, proyectos, etiquetas y herramientas. Todo es editable.</p>
        </div>
        <div className="page-actions">
          {addLabel && tab !== 'tags' && (
            <Button
              variant="primary"
              icon={<Plus size={16} />}
              onClick={() => openDialog({ type: addDialog[tab as keyof typeof addDialog] })}
            >
              {addLabel}
            </Button>
          )}
        </div>
      </header>

      <div className="tabs" role="tablist">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            className={`tab${tab === item.id ? ' is-selected' : ''}`}
            onClick={() => setParams({ tab: item.id }, { replace: true })}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === 'categories' && <CategoriesTab />}
      {tab === 'projects' && <ProjectsTab />}
      {tab === 'tags' && <TagsTab />}
      {tab === 'tools' && <ToolsTab />}
    </div>
  )
}
