import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Archive,
  Clock,
  CornerDownLeft,
  Download,
  FileText,
  FolderPlus,
  Home,
  Keyboard,
  Library,
  Monitor,
  Moon,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Star,
  Sun,
  Upload,
} from 'lucide-react'
import { ColorDot } from '@/components/ColorDot'
import { Highlight } from '@/components/Highlight'
import { Kbd } from '@/components/Kbd'
import { useCopyPrompt } from '@/hooks/useCopyPrompt'
import { useLookups, useSearchIndex } from '@/hooks/useLookups'
import { useLibrary } from '@/store/library'
import { useUi } from '@/store/ui'
import { searchPrompts, tokenize, makeSnippet } from '@shared/search'
import { nameKey } from '@shared/text'
import type { Prompt } from '@shared/types'
import { runBackup } from '../data/actions'

interface PaletteAction {
  id: string
  label: string
  icon: ReactNode
  hint?: ReactNode
  keywords?: string
  run: () => void
}

type Row = { kind: 'prompt'; prompt: Prompt } | { kind: 'action'; action: PaletteAction }

const MAX_PROMPTS = 8
const MAX_RECENT = 5

export function CommandPalette() {
  const open = useUi((s) => s.paletteOpen)
  return open ? <PaletteDialog /> : null
}

function PaletteDialog() {
  const dialog = useRef<HTMLDialogElement>(null)
  const list = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const copyPrompt = useCopyPrompt()
  const prompts = useLibrary((s) => s.prompts)
  const lookups = useLookups()
  const index = useSearchIndex()
  const { setPaletteOpen, openDialog, setTheme } = useUi.getState()
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)

  useEffect(() => {
    dialog.current?.showModal()
  }, [])

  const close = () => setPaletteOpen(false)
  const go = (path: string) => () => navigate(path)

  const actions = useMemo<PaletteAction[]>(
    () => [
      {
        id: 'new',
        label: 'Nuevo prompt',
        icon: <Plus size={16} />,
        hint: <Kbd keys={['mod', 'N']} />,
        keywords: 'crear añadir',
        run: go('/new'),
      },
      {
        id: 'new-category',
        label: 'Nueva categoría',
        icon: <FolderPlus size={16} />,
        keywords: 'crear',
        run: () => openDialog({ type: 'category' }),
      },
      {
        id: 'new-project',
        label: 'Nuevo proyecto',
        icon: <FolderPlus size={16} />,
        keywords: 'crear',
        run: () => openDialog({ type: 'project' }),
      },
      { id: 'home', label: 'Ir a Inicio', icon: <Home size={16} />, run: go('/') },
      { id: 'all', label: 'Ir a Todos los prompts', icon: <Library size={16} />, keywords: 'biblioteca', run: go('/library') },
      { id: 'favorites', label: 'Ir a Favoritos', icon: <Star size={16} />, keywords: 'estrella', run: go('/favorites') },
      { id: 'recent', label: 'Ir a Recientes', icon: <Clock size={16} />, keywords: 'usados', run: go('/recent') },
      { id: 'archived', label: 'Ir a Archivados', icon: <Archive size={16} />, run: go('/archived') },
      {
        id: 'organize',
        label: 'Organizar categorías, proyectos y etiquetas',
        icon: <SlidersHorizontal size={16} />,
        keywords: 'gestionar etiquetas',
        run: go('/organize'),
      },
      {
        id: 'import',
        label: 'Importar prompts',
        icon: <Upload size={16} />,
        keywords: 'pegar archivo csv json markdown',
        run: () => openDialog({ type: 'import' }),
      },
      {
        id: 'export',
        label: 'Exportar biblioteca',
        icon: <Download size={16} />,
        keywords: 'json csv markdown txt',
        run: () => openDialog({ type: 'export' }),
      },
      {
        id: 'backup',
        label: 'Crear backup',
        icon: <ShieldCheck size={16} />,
        keywords: 'copia seguridad guardar',
        run: () => void runBackup(),
      },
      { id: 'settings', label: 'Ajustes', icon: <Settings size={16} />, keywords: 'preferencias datos', run: go('/settings') },
      { id: 'theme-light', label: 'Tema claro', icon: <Sun size={16} />, keywords: 'apariencia', run: () => setTheme('light') },
      { id: 'theme-dark', label: 'Tema oscuro', icon: <Moon size={16} />, keywords: 'apariencia noche', run: () => setTheme('dark') },
      {
        id: 'theme-system',
        label: 'Tema del sistema',
        icon: <Monitor size={16} />,
        keywords: 'apariencia automático',
        run: () => setTheme('system'),
      },
      {
        id: 'shortcuts',
        label: 'Atajos de teclado',
        icon: <Keyboard size={16} />,
        keywords: 'ayuda teclas',
        run: () => openDialog({ type: 'shortcuts' }),
      },
    ],
    // Solo usan funciones estables (navigate y acciones del store): se crean una vez.
    [],
  )

  const tokens = useMemo(() => tokenize(query), [query])

  const rows = useMemo<Row[]>(() => {
    const byId = new Map(prompts.map((p) => [p.id, p]))
    let promptRows: Prompt[]
    if (tokens.length > 0) {
      promptRows = searchPrompts(index, query)
        .map((hit) => byId.get(hit.id))
        .filter((p): p is Prompt => p !== undefined && !p.archived)
        .slice(0, MAX_PROMPTS)
    } else {
      promptRows = prompts
        .filter((p) => !p.archived && p.lastUsedAt)
        .sort((a, b) => (b.lastUsedAt ?? '').localeCompare(a.lastUsedAt ?? ''))
        .slice(0, MAX_RECENT)
    }
    const matchingActions = actions.filter(
      (a) => tokens.length === 0 || tokens.every((t) => nameKey(`${a.label} ${a.keywords ?? ''}`).includes(t)),
    )
    return [
      ...promptRows.map((prompt): Row => ({ kind: 'prompt', prompt })),
      ...matchingActions.map((action): Row => ({ kind: 'action', action })),
    ]
  }, [prompts, index, query, tokens, actions])

  const firstActionIndex = rows.findIndex((r) => r.kind === 'action')

  useEffect(() => {
    list.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' })
  }, [active, rows])

  const run = (row: Row | undefined, copy = false) => {
    if (!row) return
    close()
    if (row.kind === 'action') row.action.run()
    else if (copy) void copyPrompt(row.prompt)
    else navigate(`/prompt/${row.prompt.id}`)
  }

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'ArrowDown') setActive((i) => Math.min(i + 1, rows.length - 1))
    else if (event.key === 'ArrowUp') setActive((i) => Math.max(i - 1, 0))
    else if (event.key === 'Enter') run(rows[active], event.ctrlKey || event.metaKey)
    else return
    event.preventDefault()
  }

  const renderPrompt = (prompt: Prompt, rowIndex: number) => {
    const category = prompt.categoryId ? lookups.categories.get(prompt.categoryId) : undefined
    const tool = lookups.tools.get(prompt.toolId)
    const snippet =
      tokens.length > 0 && !tokens.every((t) => nameKey(prompt.title).includes(t)) ? makeSnippet(prompt.content, tokens, 48) : null
    return (
      <>
        <FileText size={16} className="palette-row-icon" aria-hidden />
        <span className="palette-row-main">
          <span className="palette-row-title truncate">
            <Highlight text={prompt.title} tokens={tokens} />
          </span>
          <span className="palette-row-sub truncate">
            {snippet ? (
              <Highlight text={snippet.text} tokens={tokens} />
            ) : (
              <>
                {category && (
                  <>
                    <ColorDot color={category.color} size={7} /> {category.name} ·{' '}
                  </>
                )}
                {tool?.name}
              </>
            )}
          </span>
        </span>
        {rowIndex === active && (
          <span className="palette-row-hint">
            <Kbd keys={['mod', '↵']} /> copiar
          </span>
        )}
      </>
    )
  }

  const heading = (text: string) => <div className="palette-heading">{text}</div>

  return (
    <dialog
      ref={dialog}
      className="palette"
      aria-label="Paleta de comandos"
      onCancel={(event) => {
        event.preventDefault()
        close()
      }}
      onMouseDown={(event) => {
        if (event.target === dialog.current) close()
      }}
    >
      <div className="palette-panel">
        <div className="palette-input">
          <Search size={18} aria-hidden />
          <input
            value={query}
            placeholder="Busca un prompt o escribe una acción…"
            aria-label="Buscar prompts y acciones"
            onChange={(event) => {
              setQuery(event.target.value)
              setActive(0)
            }}
            onKeyDown={onKeyDown}
          />
          <Kbd keys={['Esc']} />
        </div>

        <div className="palette-list" ref={list} role="listbox" aria-label="Resultados">
          {rows.length === 0 && (
            <p className="palette-empty">
              Nada coincide con «{query}». <br />
              <span className="faint">
                Prueba con otra palabra: se busca en título, contenido, categoría, etiquetas, proyecto y herramienta.
              </span>
            </p>
          )}
          {rows.map((row, i) => (
            <div key={row.kind === 'prompt' ? row.prompt.id : row.action.id}>
              {i === 0 && row.kind === 'prompt' && heading(tokens.length > 0 ? 'Prompts' : 'Usados recientemente')}
              {i === firstActionIndex && heading('Acciones')}
              <button
                type="button"
                role="option"
                aria-selected={i === active}
                data-active={i === active}
                className={`palette-row${i === active ? ' is-active' : ''}`}
                onMouseMove={() => i !== active && setActive(i)}
                onClick={(event) => run(row, event.ctrlKey || event.metaKey)}
              >
                {row.kind === 'prompt' ? (
                  renderPrompt(row.prompt, i)
                ) : (
                  <>
                    <span className="palette-row-icon">{row.action.icon}</span>
                    <span className="palette-row-main">
                      <span className="palette-row-title">{row.action.label}</span>
                    </span>
                    {row.action.hint ?? (i === active && <CornerDownLeft size={14} className="faint" aria-hidden />)}
                  </>
                )}
              </button>
            </div>
          ))}
        </div>

        <footer className="palette-footer">
          <span>
            <Kbd keys={['↑', '↓']} /> navegar
          </span>
          <span>
            <Kbd keys={['↵']} /> abrir
          </span>
          <span>
            <Kbd keys={['mod', '↵']} /> copiar prompt
          </span>
        </footer>
      </div>
    </dialog>
  )
}
