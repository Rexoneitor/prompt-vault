import { useEffect, useMemo, useRef, useState } from 'react'
import { useBlocker, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Braces, Code2, FileX, List, Star } from 'lucide-react'
import { Button, IconButton } from '@/components/Button'
import { Combobox } from '@/components/Combobox'
import { EmptyState } from '@/components/EmptyState'
import { Kbd } from '@/components/Kbd'
import { TagInput } from '@/components/TagInput'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useShortcut } from '@/hooks/useShortcut'
import { useLibrary } from '@/store/library'
import { attempt, useUi } from '@/store/ui'
import { applyPatch, insertCodeBlock, insertVariable, toggleBulletList, type TextPatch } from '@/utils/textarea'
import { CATEGORY_COLORS } from '@shared/palette'
import { countWords, estimateTokens, nameKey, pluralize } from '@shared/text'
import { GENERAL_TOOL_ID, type Category, type Project, type Prompt, type PromptDraft, type Tag } from '@shared/types'
import { extractVariables } from '@shared/variables'

interface EditorLocationState {
  /** Contenido o título con el que arrancar un prompt nuevo (importar texto, crear desde la búsqueda). */
  content?: string
  title?: string
  /** Al duplicar: seleccionar el título para renombrar la copia enseguida. */
  focusTitle?: boolean
}

const EMPTY: PromptDraft = {
  title: '',
  description: '',
  content: '',
  notes: '',
  categoryId: null,
  projectId: null,
  toolId: GENERAL_TOOL_ID,
  tags: [],
  favorite: false,
}

interface InitialDraftSources {
  existing: Prompt | undefined
  tags: Tag[]
  categories: Category[]
  projects: Project[]
  params: URLSearchParams
  state: EditorLocationState
}

/** Borrador de partida: el prompt que se edita, o uno nuevo con lo que traiga la ruta (categoría, proyecto, etiqueta…). */
function initialDraft({ existing, tags, categories, projects, params, state }: InitialDraftSources): PromptDraft {
  if (existing) {
    const names = existing.tagIds.map((tagId) => tags.find((t) => t.id === tagId)?.name).filter((name): name is string => Boolean(name))
    return {
      title: existing.title,
      description: existing.description,
      content: existing.content,
      notes: existing.notes,
      categoryId: existing.categoryId,
      projectId: existing.projectId,
      toolId: existing.toolId,
      tags: names,
      favorite: existing.favorite,
    }
  }
  const tagName = params.get('tag')
  return {
    ...EMPTY,
    title: state.title ?? '',
    content: state.content ?? '',
    categoryId: categories.some((c) => c.id === params.get('category')) ? params.get('category') : null,
    projectId: projects.some((p) => p.id === params.get('project')) ? params.get('project') : null,
    tags: tagName ? [tagName] : [],
    favorite: params.get('favorite') === '1',
  }
}

const sameDraft = (a: PromptDraft, b: PromptDraft) =>
  a.title === b.title &&
  a.description === b.description &&
  a.content === b.content &&
  a.notes === b.notes &&
  a.categoryId === b.categoryId &&
  a.projectId === b.projectId &&
  a.toolId === b.toolId &&
  a.favorite === b.favorite &&
  a.tags.length === b.tags.length &&
  a.tags.every((tag, index) => tag === b.tags[index])

export function EditorPage() {
  const { id } = useParams()
  const isEdit = id !== undefined
  useDocumentTitle(isEdit ? 'Editar prompt' : 'Nuevo prompt')
  const navigate = useNavigate()
  const location = useLocation()
  const [params] = useSearchParams()
  const state = (location.state ?? {}) as EditorLocationState

  const existing = useLibrary((s) => (id ? s.prompts.find((p) => p.id === id) : undefined))
  const categories = useLibrary((s) => s.categories)
  const projects = useLibrary((s) => s.projects)
  const tools = useLibrary((s) => s.tools)
  const tags = useLibrary((s) => s.tags)

  // El estado inicial se fija al abrir el editor: cambios externos posteriores no deben pisar lo que se está escribiendo.
  const [initial] = useState<PromptDraft>(() => initialDraft({ existing, tags, categories, projects, params, state }))
  const [draft, setDraft] = useState<PromptDraft>(initial)
  const [contentError, setContentError] = useState<string | null>(null)
  const [keepPrevious, setKeepPrevious] = useState(false)
  const [changeNote, setChangeNote] = useState('')
  const [saving, setSaving] = useState(false)
  const savedRef = useRef(false)
  const titleInput = useRef<HTMLInputElement>(null)
  const contentArea = useRef<HTMLTextAreaElement>(null)

  const dirty = !sameDraft(draft, initial)
  const contentChanged = isEdit && draft.content !== initial.content
  const update = <K extends keyof PromptDraft>(key: K, value: PromptDraft[K]) => setDraft((current) => ({ ...current, [key]: value }))

  useEffect(() => {
    if (state.focusTitle) titleInput.current?.select()
    else if (!isEdit && !state.content) titleInput.current?.focus()
  }, [])

  /* ---------------------------- protección ante pérdida de cambios ---------------------------- */
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) => dirty && !savedRef.current && currentLocation.pathname !== nextLocation.pathname,
  )
  useEffect(() => {
    if (blocker.state !== 'blocked') return
    void useUi
      .getState()
      .confirm({
        title: '¿Salir sin guardar?',
        message: 'Tienes cambios sin guardar en este prompt. Si sales ahora se perderán.',
        confirmLabel: 'Descartar cambios',
        danger: true,
      })
      .then((answer) => (answer === 'confirm' ? blocker.proceed() : blocker.reset()))
  }, [blocker])
  useEffect(() => {
    if (!dirty) return
    const warn = (event: BeforeUnloadEvent) => event.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  /* --------------------------------------- guardado --------------------------------------- */
  const save = async () => {
    if (saving) return
    if (draft.content.trim().length === 0) {
      setContentError('El prompt está vacío: escribe su contenido antes de guardar.')
      contentArea.current?.focus()
      return
    }

    // Aviso (no bloqueo) si ya existe un prompt idéntico.
    if (!isEdit || contentChanged) {
      const twin = useLibrary.getState().prompts.find((p) => p.id !== id && p.content.trim() === draft.content.trim())
      if (twin) {
        const answer = await useUi.getState().confirm({
          title: 'Ya tienes un prompt igual',
          message: `El contenido coincide con «${twin.title}». ¿Quieres guardarlo de todos modos?`,
          confirmLabel: 'Guardar igualmente',
        })
        if (answer !== 'confirm') return
      }
    }

    setSaving(true)
    const prompt = await attempt(() => {
      const { createPrompt, updatePrompt } = useLibrary.getState()
      return id
        ? updatePrompt(id, draft, keepPrevious && contentChanged ? { snapshotPrevious: { notes: changeNote } } : undefined)
        : createPrompt(draft)
    })
    setSaving(false)
    if (!prompt) return
    savedRef.current = true
    void useLibrary.getState().markWelcomeDone()
    useUi.getState().toast(isEdit ? 'Cambios guardados' : 'Prompt creado')
    navigate(`/prompt/${prompt.id}`, { replace: true })
  }

  const cancel = () => navigate(isEdit ? `/prompt/${id}` : '/library')
  useShortcut('mod+s', () => void save())

  /* --------------------------------- barra de herramientas --------------------------------- */
  const applyToolbar = (makePatch: (selection: { value: string; start: number; end: number }) => TextPatch) => {
    const area = contentArea.current
    if (!area) return
    const patch = makePatch({ value: area.value, start: area.selectionStart, end: area.selectionEnd })
    area.focus()
    area.setSelectionRange(patch.from, patch.to)
    // execCommand conserva el historial de deshacer; si no está disponible se escribe el valor directamente.
    if (!document.execCommand('insertText', false, patch.insert)) update('content', applyPatch(area.value, patch))
    area.setSelectionRange(patch.selectStart, patch.selectEnd)
    setContentError(null)
  }

  const variables = useMemo(() => extractVariables(draft.content), [draft.content])

  if (isEdit && !existing) {
    return (
      <div className="page page-center">
        <EmptyState
          icon={<FileX size={24} />}
          title="Este prompt no existe."
          message="Puede que se haya eliminado."
          actions={
            <Button variant="primary" onClick={() => navigate('/library')}>
              Ir a la biblioteca
            </Button>
          }
        />
      </div>
    )
  }

  /* ------------------------------- creación al vuelo de taxonomía ------------------------------- */
  const createCategory = async (name: string) =>
    (
      await attempt(() =>
        useLibrary.getState().createCategory({ name, color: CATEGORY_COLORS[categories.length % CATEGORY_COLORS.length] }),
      )
    )?.id
  const createProject = async (name: string) => (await attempt(() => useLibrary.getState().createProject({ name, description: '' })))?.id
  const createTool = async (name: string) => (await attempt(() => useLibrary.getState().createTool({ name })))?.id

  return (
    <div className="page page-editor">
      <header className="editor-bar">
        <div className="editor-bar-left">
          <IconButton label="Cancelar y volver" onClick={cancel}>
            <ArrowLeft size={18} />
          </IconButton>
          <span className="editor-bar-title">{isEdit ? 'Editar prompt' : 'Nuevo prompt'}</span>
          {dirty && <span className="editor-dirty">Sin guardar</span>}
        </div>
        <div className="editor-bar-actions">
          <Button variant="ghost" onClick={cancel}>
            Cancelar
          </Button>
          <Button variant="primary" loading={saving} onClick={() => void save()}>
            Guardar
            <Kbd keys={['mod', 'S']} />
          </Button>
        </div>
      </header>

      <div className="editor-layout">
        <div className="editor-main">
          <input
            ref={titleInput}
            className="editor-title"
            value={draft.title}
            maxLength={200}
            placeholder="Título del prompt"
            aria-label="Título"
            onChange={(e) => update('title', e.target.value)}
          />
          <input
            className="editor-description"
            value={draft.description}
            maxLength={2000}
            placeholder="Descripción breve (opcional)"
            aria-label="Descripción"
            onChange={(e) => update('description', e.target.value)}
          />

          <div className={`editor-card${contentError ? ' has-error' : ''}`}>
            <div className="editor-toolbar" role="toolbar" aria-label="Formato">
              <IconButton label="Insertar variable {{ }}" size="sm" tipSide="bottom" onClick={() => applyToolbar(insertVariable)}>
                <Braces size={16} />
              </IconButton>
              <IconButton label="Bloque de código" size="sm" tipSide="bottom" onClick={() => applyToolbar(insertCodeBlock)}>
                <Code2 size={16} />
              </IconButton>
              <IconButton label="Lista con viñetas" size="sm" tipSide="bottom" onClick={() => applyToolbar(toggleBulletList)}>
                <List size={16} />
              </IconButton>
              <span className="editor-toolbar-hint">Usa {'{{nombre}}'} para crear variables reutilizables</span>
            </div>
            <textarea
              ref={contentArea}
              className="editor-content"
              value={draft.content}
              placeholder="Escribe aquí tu prompt…"
              aria-label="Contenido del prompt"
              aria-invalid={contentError !== null}
              spellCheck
              onChange={(e) => {
                update('content', e.target.value)
                if (contentError) setContentError(null)
              }}
            />
            <footer className="editor-footer">
              <span>
                {pluralize(countWords(draft.content), 'palabra', 'palabras')} · {draft.content.length.toLocaleString('es')} caracteres · ~
                {estimateTokens(draft.content).toLocaleString('es')} tokens
              </span>
              {variables.length > 0 && (
                <span className="editor-vars">
                  {pluralize(variables.length, 'variable', 'variables')}: {variables.map((v) => `{{${v}}}`).join(' ')}
                </span>
              )}
            </footer>
          </div>
          {contentError && (
            <p className="field-error" role="alert">
              {contentError}
            </p>
          )}

          {contentChanged && (
            <div className="keep-previous">
              <label className="check-row">
                <input type="checkbox" className="checkbox" checked={keepPrevious} onChange={(e) => setKeepPrevious(e.target.checked)} />
                Guardar la versión anterior en el historial antes de aplicar los cambios
              </label>
              {keepPrevious && (
                <input
                  className="input"
                  value={changeNote}
                  placeholder="Nota sobre el cambio (opcional)"
                  aria-label="Nota sobre el cambio"
                  onChange={(e) => setChangeNote(e.target.value)}
                />
              )}
            </div>
          )}
        </div>

        <aside className="editor-side" aria-label="Propiedades">
          <div className="side-card">
            <h2 className="side-title">Clasificación</h2>
            <div className="field">
              <span className="field-label">Categoría</span>
              <Combobox
                label="Categoría"
                value={draft.categoryId}
                onChange={(value) => update('categoryId', value)}
                options={categories.map((c) => ({ id: c.id, label: c.name, color: c.color }))}
                placeholder="Sin categoría"
                clearLabel="Sin categoría"
                onCreate={createCategory}
                createLabel={(name) => `Crear categoría «${name}»`}
                searchPlaceholder="Buscar o crear categoría…"
              />
            </div>
            <div className="field">
              <span className="field-label">Proyecto</span>
              <Combobox
                label="Proyecto"
                value={draft.projectId}
                onChange={(value) => update('projectId', value)}
                options={projects.map((p) => ({ id: p.id, label: p.name }))}
                placeholder="Sin proyecto"
                clearLabel="Sin proyecto"
                onCreate={createProject}
                createLabel={(name) => `Crear proyecto «${name}»`}
                searchPlaceholder="Buscar o crear proyecto…"
              />
            </div>
            <div className="field">
              <span className="field-label">Herramienta / IA</span>
              <Combobox
                label="Herramienta"
                value={draft.toolId}
                onChange={(value) => update('toolId', value ?? GENERAL_TOOL_ID)}
                options={tools.map((t) => ({ id: t.id, label: t.name }))}
                placeholder="General"
                onCreate={createTool}
                createLabel={(name) => `Añadir herramienta «${name}»`}
                searchPlaceholder="Buscar o añadir herramienta…"
              />
            </div>
            <div className="field">
              <span className="field-label">Etiquetas</span>
              <TagInput
                value={draft.tags}
                onChange={(value) => update('tags', value)}
                suggestions={tags.map((t) => t.name).filter((name) => !draft.tags.some((tag) => nameKey(tag) === nameKey(name)))}
              />
            </div>
            <button
              type="button"
              className={`fav-toggle${draft.favorite ? ' is-fav' : ''}`}
              aria-pressed={draft.favorite}
              onClick={() => update('favorite', !draft.favorite)}
            >
              <Star size={16} fill={draft.favorite ? 'currentColor' : 'none'} />
              {draft.favorite ? 'En favoritos' : 'Marcar como favorito'}
            </button>
          </div>

          <div className="side-card">
            <h2 className="side-title">Notas personales</h2>
            <textarea
              className="textarea"
              rows={5}
              value={draft.notes}
              maxLength={20000}
              placeholder="Cuándo usarlo, qué funciona mejor, trucos…"
              aria-label="Notas personales"
              onChange={(e) => update('notes', e.target.value)}
            />
            <p className="field-hint">Solo para ti: no forman parte del prompt ni se copian.</p>
          </div>
        </aside>
      </div>
    </div>
  )
}
