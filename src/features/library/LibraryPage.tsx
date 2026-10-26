import { useDeferredValue, useMemo, useRef, useState, type ReactNode } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  Archive,
  ArchiveRestore,
  CheckSquare,
  Clock,
  Download,
  FileX,
  LayoutGrid,
  List,
  Plus,
  Search,
  SearchX,
  Sparkles,
  Star,
  Trash2,
  Upload,
  X,
} from 'lucide-react'
import { Button, IconButton } from '@/components/Button'
import { ColorDot } from '@/components/ColorDot'
import { EmptyState } from '@/components/EmptyState'
import { Select } from '@/components/Select'
import { SegmentedControl } from '@/components/SegmentedControl'
import { useLookups, useSearchIndex } from '@/hooks/useLookups'
import { useShortcut } from '@/hooks/useShortcut'
import { useLibrary } from '@/store/library'
import { attempt, useUi } from '@/store/ui'
import { readPref, writePref } from '@/utils/prefs'
import { tokenize } from '@shared/search'
import { pluralize } from '@shared/text'
import { NO_FILTERS, SORT_LABELS, selectPrompts, type Filters, type Scope, type SortKey } from './filtering'
import { PromptCard, PromptRow } from './PromptItems'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'

const isSort = (value: unknown): value is SortKey => typeof value === 'string' && value in SORT_LABELS

interface ScopeInfo {
  title: string
  /** Color de la categoría, para mostrar su punto junto al título. */
  dotColor?: string
  subtitle?: string
  missing: boolean
  /** Parámetros con los que «Nuevo prompt» nace ya clasificado en este ámbito. */
  newQuery: string
}

function useScopeInfo(scope: Scope): ScopeInfo {
  const lookups = useLookups()
  switch (scope.kind) {
    case 'favorites':
      return { title: 'Favoritos', missing: false, newQuery: '?favorite=1' }
    case 'recent':
      return { title: 'Recientes', subtitle: 'Lo que has abierto, copiado o editado últimamente.', missing: false, newQuery: '' }
    case 'archived':
      return { title: 'Archivados', subtitle: 'Fuera de tu biblioteca principal, pero a salvo.', missing: false, newQuery: '' }
    case 'category': {
      const category = lookups.categories.get(scope.id)
      return {
        title: category?.name ?? 'Categoría',
        dotColor: category?.color,
        subtitle: 'Categoría',
        missing: !category,
        newQuery: `?category=${scope.id}`,
      }
    }
    case 'project': {
      const project = lookups.projects.get(scope.id)
      return {
        title: project?.name ?? 'Proyecto',
        subtitle: project?.description || 'Proyecto',
        missing: !project,
        newQuery: `?project=${scope.id}`,
      }
    }
    case 'tag': {
      const tag = lookups.tags.get(scope.id)
      return {
        title: tag ? `#${tag.name}` : 'Etiqueta',
        subtitle: 'Etiqueta',
        missing: !tag,
        newQuery: tag ? `?tag=${encodeURIComponent(tag.name)}` : '',
      }
    }
    default:
      return { title: 'Todos los prompts', missing: false, newQuery: '' }
  }
}

export function LibraryPage({ scope }: { scope: Scope }) {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const prompts = useLibrary((s) => s.prompts)
  const categories = useLibrary((s) => s.categories)
  const projects = useLibrary((s) => s.projects)
  const tags = useLibrary((s) => s.tags)
  const tools = useLibrary((s) => s.tools)
  const viewMode = useUi((s) => s.viewMode)
  const setViewMode = useUi((s) => s.setViewMode)
  const openDialog = useUi((s) => s.openDialog)
  const index = useSearchIndex()
  const info = useScopeInfo(scope)
  useDocumentTitle(info.title)
  const searchInput = useRef<HTMLInputElement>(null)

  const [sort, setSortState] = useState<SortKey>(() => readPref('sort', 'modified', isSort))
  const [selecting, setSelecting] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const filters: Filters = {
    query: params.get('q') ?? '',
    categoryId: params.get('category'),
    projectId: params.get('project'),
    tagId: params.get('tag'),
    toolId: params.get('tool'),
    favoritesOnly: params.get('fav') === '1',
  }
  const deferredQuery = useDeferredValue(filters.query)
  const effective = { ...filters, query: deferredQuery }
  const tokens = useMemo(() => tokenize(deferredQuery), [deferredQuery])

  const setParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    setParams(next, { replace: true })
  }
  const clearFilters = () => setParams(new URLSearchParams(), { replace: true })
  const setSort = (value: SortKey) => {
    writePref('sort', value)
    setSortState(value)
  }

  const results = useMemo(
    () => selectPrompts(prompts, scope, effective, sort, index),
    [
      prompts,
      scope,
      effective.query,
      effective.categoryId,
      effective.projectId,
      effective.tagId,
      effective.toolId,
      effective.favoritesOnly,
      sort,
      index,
    ],
  )
  const inScopeCount = useMemo(() => selectPrompts(prompts, scope, NO_FILTERS, sort, index).length, [prompts, scope, sort, index])

  const activeFilterCount = [
    filters.query,
    filters.categoryId,
    filters.projectId,
    filters.tagId,
    filters.toolId,
    filters.favoritesOnly ? '1' : '',
  ].filter(Boolean).length
  const isFiltered = activeFilterCount > 0
  const archivedView = scope.kind === 'archived'

  useShortcut('/', () => searchInput.current?.focus())

  const toggleSelect = (id: string) =>
    setSelected((current) => {
      const next = new Set(current)
      if (!next.delete(id)) next.add(id)
      return next
    })
  const stopSelecting = () => {
    setSelecting(false)
    setSelected(new Set())
  }

  /* --------------------------- acciones sobre la selección --------------------------- */
  const archiveSelected = async () => {
    const ids = [...selected]
    const done = await attempt(async () => {
      await useLibrary.getState().setArchived(ids, !archivedView)
      return true
    })
    if (!done) return
    stopSelecting()
    useUi
      .getState()
      .toast(
        archivedView
          ? `${pluralize(ids.length, 'prompt restaurado', 'prompts restaurados')}`
          : `${pluralize(ids.length, 'prompt archivado', 'prompts archivados')}`,
        'success',
        {
          label: 'Deshacer',
          run: () => void attempt(() => useLibrary.getState().setArchived(ids, archivedView)),
        },
      )
  }

  const deleteSelected = async () => {
    const ids = [...selected]
    const answer = await useUi.getState().confirm({
      title: `Eliminar ${pluralize(ids.length, 'prompt', 'prompts')}`,
      message: 'Se borrarán para siempre, junto con su historial de versiones. Esta acción no se puede deshacer.',
      confirmLabel: 'Eliminar',
      danger: true,
      alternativeLabel: archivedView ? undefined : 'Archivar en su lugar',
    })
    if (answer === 'alternative') return archiveSelected()
    if (answer !== 'confirm') return
    const done = await attempt(
      async () => {
        await useLibrary.getState().deletePrompts(ids)
        return true
      },
      `${pluralize(ids.length, 'prompt eliminado', 'prompts eliminados')}`,
    )
    if (done) stopSelecting()
  }

  /* --------------------------------------- vacíos --------------------------------------- */
  const renderEmpty = (): ReactNode => {
    if (info.missing) {
      return (
        <EmptyState
          icon={<FileX size={24} />}
          title="Esto ya no existe"
          message="Puede que se haya eliminado o renombrado."
          actions={
            <Button variant="primary" onClick={() => navigate('/library')}>
              Ir a todos los prompts
            </Button>
          }
        />
      )
    }
    if (isFiltered && inScopeCount > 0) {
      return (
        <EmptyState
          icon={<SearchX size={24} />}
          title={filters.query ? `Sin resultados para «${filters.query}»` : 'Ningún prompt coincide'}
          message="Prueba con otra palabra o quita algún filtro. La búsqueda mira título, descripción, contenido, categoría, etiquetas, proyecto y herramienta."
          actions={
            <>
              <Button variant="secondary" onClick={clearFilters}>
                Limpiar búsqueda y filtros
              </Button>
              {filters.query && scope.kind === 'all' && (
                <Button variant="primary" icon={<Plus size={16} />} onClick={() => navigate('/new', { state: { title: filters.query } })}>
                  Crear «{filters.query}»
                </Button>
              )}
            </>
          }
        />
      )
    }
    switch (scope.kind) {
      case 'favorites':
        return (
          <EmptyState
            icon={<Star size={24} />}
            title="Todavía no tienes favoritos."
            message="Marca tus prompts más importantes con ★ para encontrarlos aquí."
            actions={
              <Button variant="primary" onClick={() => navigate('/library')}>
                Explorar prompts
              </Button>
            }
          />
        )
      case 'recent':
        return (
          <EmptyState
            icon={<Clock size={24} />}
            title="Aún no has usado ningún prompt."
            message="Aquí aparecerán los que abras, copies o edites, para que vuelvas a ellos en un clic."
            actions={
              <Button variant="primary" onClick={() => navigate('/library')}>
                Explorar prompts
              </Button>
            }
          />
        )
      case 'archived':
        return (
          <EmptyState
            icon={<Archive size={24} />}
            title="No hay prompts archivados."
            message="Archiva los que ya no uses para mantener limpia tu biblioteca sin perderlos."
          />
        )
      case 'all':
        return (
          <EmptyState
            icon={<Sparkles size={24} />}
            title="Tu biblioteca está vacía."
            message="Crea tu primer prompt, importa los que ya tienes o carga unos ejemplos para explorar."
            actions={
              <>
                <Button variant="primary" icon={<Plus size={16} />} onClick={() => navigate('/new')}>
                  Crear prompt
                </Button>
                <Button variant="secondary" icon={<Upload size={16} />} onClick={() => openDialog({ type: 'import' })}>
                  Importar
                </Button>
              </>
            }
          />
        )
      default:
        return (
          <EmptyState
            icon={<Sparkles size={24} />}
            title="Aquí todavía no hay prompts."
            message="Asigna este elemento a un prompt desde el editor, o crea uno nuevo ya con él seleccionado."
            actions={
              <Button variant="primary" icon={<Plus size={16} />} onClick={() => navigate(`/new${info.newQuery}`)}>
                Nuevo prompt aquí
              </Button>
            }
          />
        )
    }
  }

  const showCategoryFilter = scope.kind !== 'category'
  const showProjectFilter = scope.kind !== 'project'
  const showTagFilter = scope.kind !== 'tag'
  const showFavFilter = scope.kind !== 'favorites'

  const selectOptions = (label: string, items: { id: string; name: string }[]) => [
    { value: '', label },
    ...items.map((item) => ({ value: item.id, label: item.name })),
  ]

  return (
    <div className="page">
      <header className="page-header">
        <div className="page-heading">
          <h1 className="page-title serif title-with-dot">
            {info.dotColor && <ColorDot color={info.dotColor} size={12} />}
            {info.title}
          </h1>
          <p className="page-subtitle">
            {isFiltered
              ? `${results.length} de ${pluralize(inScopeCount, 'prompt', 'prompts')}`
              : pluralize(inScopeCount, 'prompt', 'prompts')}
            {info.subtitle && <span className="faint"> · {info.subtitle}</span>}
          </p>
        </div>
        <div className="page-actions">
          {inScopeCount > 0 && (
            <Button
              variant={selecting ? 'secondary' : 'ghost'}
              icon={<CheckSquare size={16} />}
              onClick={() => (selecting ? stopSelecting() : setSelecting(true))}
            >
              {selecting ? 'Terminar' : 'Seleccionar'}
            </Button>
          )}
          <SegmentedControl
            label="Vista"
            iconOnly
            value={viewMode}
            onChange={setViewMode}
            options={[
              { value: 'grid', label: 'Cuadrícula', icon: <LayoutGrid size={16} /> },
              { value: 'list', label: 'Lista', icon: <List size={16} /> },
            ]}
          />
          {!archivedView && (
            <Button variant="primary" icon={<Plus size={16} />} onClick={() => navigate(`/new${info.newQuery}`)}>
              Nuevo prompt
            </Button>
          )}
        </div>
      </header>

      {inScopeCount > 0 && (
        <div className="toolbar">
          <div className="toolbar-top">
            <label className="search-field">
              <Search size={16} aria-hidden />
              <input
                ref={searchInput}
                value={filters.query}
                placeholder="Buscar en título, contenido, etiquetas…"
                aria-label="Buscar prompts"
                onChange={(event) => setParam('q', event.target.value || null)}
                onKeyDown={(event) => {
                  if (event.key === 'Escape') {
                    if (filters.query) setParam('q', null)
                    else event.currentTarget.blur()
                  }
                }}
              />
              {filters.query && (
                <IconButton label="Borrar búsqueda" size="sm" onClick={() => setParam('q', null)}>
                  <X size={14} />
                </IconButton>
              )}
            </label>
            {scope.kind !== 'recent' && (
              <Select
                aria-label="Ordenar por"
                wrapperClassName="sort"
                value={filters.query ? 'relevance' : sort}
                disabled={Boolean(filters.query)}
                onChange={(e) => setSort(e.target.value as SortKey)}
                options={
                  filters.query
                    ? [{ value: 'relevance', label: 'Más relevantes' }]
                    : (Object.entries(SORT_LABELS) as [SortKey, string][]).map(([value, label]) => ({ value, label }))
                }
              />
            )}
          </div>

          <div className="filters">
            {showCategoryFilter && categories.length > 0 && (
              <Select
                aria-label="Filtrar por categoría"
                wrapperClassName={`filter${filters.categoryId ? ' is-active' : ''}`}
                value={filters.categoryId ?? ''}
                onChange={(e) => setParam('category', e.target.value || null)}
                options={selectOptions('Categoría', categories)}
              />
            )}
            {showTagFilter && tags.length > 0 && (
              <Select
                aria-label="Filtrar por etiqueta"
                wrapperClassName={`filter${filters.tagId ? ' is-active' : ''}`}
                value={filters.tagId ?? ''}
                onChange={(e) => setParam('tag', e.target.value || null)}
                options={selectOptions('Etiqueta', tags)}
              />
            )}
            {showProjectFilter && projects.length > 0 && (
              <Select
                aria-label="Filtrar por proyecto"
                wrapperClassName={`filter${filters.projectId ? ' is-active' : ''}`}
                value={filters.projectId ?? ''}
                onChange={(e) => setParam('project', e.target.value || null)}
                options={selectOptions('Proyecto', projects)}
              />
            )}
            <Select
              aria-label="Filtrar por herramienta"
              wrapperClassName={`filter${filters.toolId ? ' is-active' : ''}`}
              value={filters.toolId ?? ''}
              onChange={(e) => setParam('tool', e.target.value || null)}
              options={selectOptions('Herramienta', tools)}
            />
            {showFavFilter && (
              <button
                type="button"
                className={`filter-toggle${filters.favoritesOnly ? ' is-active' : ''}`}
                aria-pressed={filters.favoritesOnly}
                onClick={() => setParam('fav', filters.favoritesOnly ? null : '1')}
              >
                <Star size={14} fill={filters.favoritesOnly ? 'currentColor' : 'none'} /> Favoritos
              </button>
            )}
            {isFiltered && (
              <button type="button" className="filter-clear" onClick={clearFilters}>
                Limpiar
              </button>
            )}
          </div>
        </div>
      )}

      {results.length === 0 ? (
        renderEmpty()
      ) : viewMode === 'grid' ? (
        <div className="grid" role="list">
          {results.map((prompt) => (
            <PromptCard
              key={prompt.id}
              prompt={prompt}
              tokens={tokens}
              selecting={selecting}
              selected={selected.has(prompt.id)}
              onToggleSelect={toggleSelect}
            />
          ))}
        </div>
      ) : (
        <div className="list" role="list">
          <div className="list-head" aria-hidden>
            <span />
            <span>Prompt</span>
            <span>Categoría</span>
            <span>Herramienta</span>
            <span>Etiquetas</span>
            <span />
            <span>Modificado</span>
            <span />
          </div>
          {results.map((prompt) => (
            <PromptRow
              key={prompt.id}
              prompt={prompt}
              tokens={tokens}
              selecting={selecting}
              selected={selected.has(prompt.id)}
              onToggleSelect={toggleSelect}
            />
          ))}
        </div>
      )}

      {selecting && (
        <div className="bulk-bar" role="toolbar" aria-label="Acciones sobre la selección">
          <span className="bulk-count">
            {selected.size === 0 ? 'Elige prompts' : pluralize(selected.size, 'seleccionado', 'seleccionados')}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSelected(selected.size === results.length ? new Set() : new Set(results.map((p) => p.id)))}
          >
            {selected.size === results.length ? 'Ninguno' : 'Todos'}
          </Button>
          <span className="bulk-divider" />
          <Button
            variant="ghost"
            size="sm"
            icon={<Download size={15} />}
            disabled={selected.size === 0}
            onClick={() => openDialog({ type: 'export', ids: [...selected] })}
          >
            Exportar
          </Button>
          <Button
            variant="ghost"
            size="sm"
            icon={archivedView ? <ArchiveRestore size={15} /> : <Archive size={15} />}
            disabled={selected.size === 0}
            onClick={() => void archiveSelected()}
          >
            {archivedView ? 'Restaurar' : 'Archivar'}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="bulk-danger"
            icon={<Trash2 size={15} />}
            disabled={selected.size === 0}
            onClick={() => void deleteSelected()}
          >
            Eliminar
          </Button>
          <IconButton label="Salir de la selección" size="sm" onClick={stopSelecting}>
            <X size={15} />
          </IconButton>
        </div>
      )}
    </div>
  )
}
