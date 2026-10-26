import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import {
  Archive,
  ArchiveRestore,
  ArrowLeft,
  Check,
  Copy,
  CopyPlus,
  Download,
  FileX,
  GitBranchPlus,
  MoreHorizontal,
  Pencil,
  Star,
  Trash2,
} from 'lucide-react'
import { Button, IconButton } from '@/components/Button'
import { ColorDot } from '@/components/ColorDot'
import { DropdownMenu, type MenuItem } from '@/components/DropdownMenu'
import { EmptyState } from '@/components/EmptyState'
import { Kbd } from '@/components/Kbd'
import { useCopyPrompt } from '@/hooks/useCopyPrompt'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useLookups } from '@/hooks/useLookups'
import { useShortcut } from '@/hooks/useShortcut'
import { useLibrary } from '@/store/library'
import { attempt, useUi } from '@/store/ui'
import { formatDateTime, relativeTime } from '@/utils/date'
import { countWords, estimateTokens, pluralize } from '@shared/text'
import { extractVariables, fillVariables, hasFilledValues, type VariableValues } from '@shared/variables'
import { PromptBody } from './PromptBody'
import { VariablesPanel } from './VariablesPanel'
import { VersionHistory } from './VersionHistory'

const COPIED_FEEDBACK_MS = 2200

export function PromptPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const prompt = useLibrary((s) => s.prompts.find((p) => p.id === id))
  const lookups = useLookups()
  const openDialog = useUi((s) => s.openDialog)
  const copyPrompt = useCopyPrompt()

  const [values, setValues] = useState<VariableValues>({})
  const [copied, setCopied] = useState(false)
  const copiedTimer = useRef<number>(undefined)
  const found = prompt !== undefined
  useDocumentTitle(prompt?.title)

  // Abrir un prompt cuenta como uso (actualiza «Recientes»); los valores de variables empiezan limpios.
  useEffect(() => {
    setValues({})
    setCopied(false)
    if (found) useLibrary.getState().recordOpen(id)
    return () => window.clearTimeout(copiedTimer.current)
  }, [id, found])

  const variables = useMemo(() => (prompt ? extractVariables(prompt.content) : []), [prompt])
  const filled = hasFilledValues(values)
  const textToCopy = prompt ? (filled ? fillVariables(prompt.content, values) : prompt.content) : ''

  const copy = async () => {
    if (!prompt) return
    if (await copyPrompt(prompt, { text: textToCopy, silent: true })) {
      setCopied(true)
      window.clearTimeout(copiedTimer.current)
      copiedTimer.current = window.setTimeout(() => setCopied(false), COPIED_FEEDBACK_MS)
    }
  }

  useShortcut('mod+shift+c', () => void copy(), { enabled: found })

  if (!prompt) {
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

  const category = prompt.categoryId ? lookups.categories.get(prompt.categoryId) : undefined
  const project = prompt.projectId ? lookups.projects.get(prompt.projectId) : undefined
  const tool = lookups.tools.get(prompt.toolId)
  const tags = prompt.tagIds.map((tagId) => lookups.tags.get(tagId)).filter((tag) => tag !== undefined)

  const goBack = () => (location.key !== 'default' ? navigate(-1) : navigate('/library'))

  const duplicate = async () => {
    const copy = await attempt(() => useLibrary.getState().duplicatePrompt(prompt.id))
    if (copy) {
      useUi.getState().toast('Prompt duplicado. Edita la copia a tu gusto.')
      navigate(`/prompt/${copy.id}/edit`, { state: { focusTitle: true } })
    }
  }

  const toggleArchive = async () => {
    const archive = !prompt.archived
    const done = await attempt(async () => {
      await useLibrary.getState().setArchived([prompt.id], archive)
      return true
    })
    if (!done) return
    useUi.getState().toast(archive ? 'Prompt archivado' : 'Prompt restaurado', 'success', {
      label: 'Deshacer',
      run: () => void attempt(() => useLibrary.getState().setArchived([prompt.id], !archive)),
    })
  }

  const remove = async () => {
    const answer = await useUi.getState().confirm({
      title: 'Eliminar este prompt',
      message: `«${prompt.title}» se borrará para siempre, junto con su historial de versiones. Esta acción no se puede deshacer.`,
      confirmLabel: 'Eliminar',
      danger: true,
      alternativeLabel: prompt.archived ? undefined : 'Archivar en su lugar',
    })
    if (answer === 'alternative') return toggleArchive()
    if (answer !== 'confirm') return
    const done = await attempt(async () => {
      await useLibrary.getState().deletePrompts([prompt.id])
      return true
    }, 'Prompt eliminado')
    if (done) navigate('/library', { replace: true })
  }

  const menuItems: MenuItem[] = [
    { label: 'Duplicar', icon: <CopyPlus size={16} />, onSelect: () => void duplicate() },
    { label: 'Crear versión', icon: <GitBranchPlus size={16} />, onSelect: () => openDialog({ type: 'version', promptId: prompt.id }) },
    {
      label: prompt.archived ? 'Restaurar de archivados' : 'Archivar',
      icon: prompt.archived ? <ArchiveRestore size={16} /> : <Archive size={16} />,
      onSelect: () => void toggleArchive(),
    },
    { label: 'Exportar este prompt', icon: <Download size={16} />, onSelect: () => openDialog({ type: 'export', ids: [prompt.id] }) },
    { label: 'Eliminar', icon: <Trash2 size={16} />, danger: true, separatorBefore: true, onSelect: () => void remove() },
  ]

  return (
    <div className="page page-prompt">
      <nav className="crumbs" aria-label="Navegación">
        <button type="button" className="crumb-back" onClick={goBack}>
          <ArrowLeft size={15} aria-hidden /> Volver
        </button>
      </nav>

      <header className="prompt-header">
        <h1 className="prompt-title serif">
          {prompt.title}
          {prompt.isDemo && <span className="demo-badge">Demo</span>}
          {prompt.archived && <span className="chip">Archivado</span>}
        </h1>
        {prompt.description && <p className="prompt-description">{prompt.description}</p>}
        <div className="prompt-meta">
          {category ? (
            <Link to={`/category/${category.id}`} className="meta-link">
              <ColorDot color={category.color} /> {category.name}
            </Link>
          ) : (
            <span className="meta-link is-empty">Sin categoría</span>
          )}
          {project && (
            <Link to={`/project/${project.id}`} className="meta-link">
              <span className="nav-hash">▸</span> {project.name}
            </Link>
          )}
          <span className="tool-badge">{tool?.name ?? 'General'}</span>
          {tags.map((tag) => (
            <Link key={tag.id} to={`/tag/${tag.id}`} className="chip chip-link">
              #{tag.name}
            </Link>
          ))}
        </div>
      </header>

      <div className="prompt-actions">
        <Button
          variant="primary"
          size="lg"
          className={`copy-btn${copied ? ' is-copied' : ''}`}
          icon={copied ? <Check size={19} /> : <Copy size={18} />}
          onClick={() => void copy()}
          aria-live="polite"
        >
          {copied ? 'Copiado' : filled ? 'Copiar completado' : 'Copiar prompt'}
        </Button>
        <span className="copy-shortcut">
          <Kbd keys={['mod', 'Shift', 'C']} />
        </span>
        <span className="prompt-actions-spacer" />
        <Button variant="secondary" icon={<Pencil size={15} />} onClick={() => navigate(`/prompt/${prompt.id}/edit`)}>
          Editar
        </Button>
        <IconButton
          label={prompt.favorite ? 'Quitar de favoritos' : 'Marcar como favorito'}
          active={prompt.favorite}
          className={prompt.favorite ? 'is-fav' : ''}
          onClick={() => void attempt(() => useLibrary.getState().setFavorite(prompt.id, !prompt.favorite))}
        >
          <Star size={18} fill={prompt.favorite ? 'currentColor' : 'none'} />
        </IconButton>
        <IconButton label="Duplicar" onClick={() => void duplicate()}>
          <CopyPlus size={18} />
        </IconButton>
        <IconButton label="Crear versión" onClick={() => openDialog({ type: 'version', promptId: prompt.id })}>
          <GitBranchPlus size={18} />
        </IconButton>
        <DropdownMenu
          label="Más acciones"
          items={menuItems}
          trigger={(props) => (
            <IconButton label="Más acciones" {...props}>
              <MoreHorizontal size={18} />
            </IconButton>
          )}
        />
      </div>

      {variables.length > 0 && <VariablesPanel names={variables} values={values} onChange={setValues} />}

      <section className="prompt-card" aria-label="Contenido del prompt">
        <header className="prompt-card-header">
          <span className="prompt-card-label">Prompt</span>
          <span className="prompt-card-stats">
            {pluralize(countWords(textToCopy), 'palabra', 'palabras')} · {textToCopy.length.toLocaleString('es')} caracteres · ~
            {estimateTokens(textToCopy).toLocaleString('es')} tokens
          </span>
        </header>
        <PromptBody content={prompt.content} values={values} />
      </section>

      {prompt.notes && (
        <section className="notes-card" aria-label="Notas personales">
          <h2 className="notes-title">Notas personales</h2>
          <p className="notes-text">{prompt.notes}</p>
        </section>
      )}

      <VersionHistory prompt={prompt} />

      <footer className="prompt-footnote">
        <span>Creado {formatDateTime(prompt.createdAt)}</span>
        <span>Modificado {relativeTime(prompt.updatedAt)}</span>
        <span>Último uso {relativeTime(prompt.lastUsedAt)}</span>
        <span>{prompt.usageCount === 0 ? 'Sin copias todavía' : `Copiado ${pluralize(prompt.usageCount, 'vez', 'veces')}`}</span>
      </footer>
    </div>
  )
}
