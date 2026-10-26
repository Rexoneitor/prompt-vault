import { useEffect, useState } from 'react'
import { ChevronDown, Copy, GitCompare, History, Plus, RotateCcw, Trash2 } from 'lucide-react'
import { api } from '@/api/client'
import { Button, IconButton } from '@/components/Button'
import { useCopyPrompt } from '@/hooks/useCopyPrompt'
import { useLibrary } from '@/store/library'
import { attempt, useUi } from '@/store/ui'
import { formatDateTime, relativeTime } from '@/utils/date'
import { diffLines } from '@/utils/diff'
import type { Prompt, PromptVersion } from '@shared/types'

function DiffView({ before, after }: { before: string; after: string }) {
  const lines = diffLines(before, after)
  const changed = lines.some((line) => line.type !== 'same')
  if (!changed) return <p className="version-same">Idéntica al contenido actual.</p>
  return (
    <pre className="diff">
      {lines.map((line, index) => (
        <span key={index} className={`diff-line diff-${line.type}`}>
          <span className="diff-mark" aria-hidden>
            {line.type === 'add' ? '+' : line.type === 'del' ? '−' : ' '}
          </span>
          {line.text || ' '}
          {'\n'}
        </span>
      ))}
    </pre>
  )
}

function VersionItem({ prompt, version }: { prompt: Prompt; version: PromptVersion }) {
  const [open, setOpen] = useState(false)
  const [compare, setCompare] = useState(false)
  const copyPrompt = useCopyPrompt()

  const restore = async () => {
    const answer = await useUi.getState().confirm({
      title: `Restaurar la versión ${version.version}`,
      message:
        'El contenido actual del prompt se reemplazará por el de esta versión. Si el actual no estaba guardado en el historial, se conservará antes como una versión más: no pierdes nada.',
      confirmLabel: 'Restaurar',
    })
    if (answer !== 'confirm') return
    await attempt(() => useLibrary.getState().restoreVersion(version.id), `Versión ${version.version} restaurada`)
  }

  const remove = async () => {
    const answer = await useUi.getState().confirm({
      title: `Eliminar la versión ${version.version}`,
      message: 'Se quitará del historial. El contenido actual del prompt no cambia.',
      confirmLabel: 'Eliminar versión',
      danger: true,
    })
    if (answer !== 'confirm') return
    await attempt(() => useLibrary.getState().deleteVersion(version.id), 'Versión eliminada')
  }

  return (
    <li className={`version${open ? ' is-open' : ''}`}>
      <button type="button" className="version-head" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span className="version-number">v{version.version}</span>
        <span className="version-main">
          <span className="version-name truncate">{version.name ?? `Versión ${version.version}`}</span>
          {version.notes && <span className="version-notes truncate">{version.notes}</span>}
        </span>
        <span className="version-date" title={formatDateTime(version.createdAt)}>
          {relativeTime(version.createdAt)}
        </span>
        <ChevronDown size={15} className="version-chevron" aria-hidden />
      </button>
      {open && (
        <div className="version-body">
          {version.notes && <p className="version-note-full">{version.notes}</p>}
          {compare ? (
            <DiffView before={version.content} after={prompt.content} />
          ) : (
            <pre className="version-content">{version.content}</pre>
          )}
          <div className="version-actions">
            <Button size="sm" variant="secondary" icon={<RotateCcw size={14} />} onClick={() => void restore()}>
              Restaurar
            </Button>
            <Button size="sm" variant="ghost" icon={<GitCompare size={14} />} onClick={() => setCompare(!compare)}>
              {compare ? 'Ver contenido' : 'Comparar con el actual'}
            </Button>
            <Button size="sm" variant="ghost" icon={<Copy size={14} />} onClick={() => void copyPrompt(prompt, { text: version.content })}>
              Copiar esta versión
            </Button>
            <IconButton label="Eliminar versión" size="sm" className="version-delete" onClick={() => void remove()}>
              <Trash2 size={15} />
            </IconButton>
          </div>
        </div>
      )}
    </li>
  )
}

/** Historial simplificado: instantáneas manuales del contenido, con restauración y comparación. */
export function VersionHistory({ prompt }: { prompt: Prompt }) {
  const openDialog = useUi((s) => s.openDialog)
  const [open, setOpen] = useState(false)
  const [versions, setVersions] = useState<PromptVersion[] | null>(null)

  // Se recarga al abrir y cada vez que cambia lo que hay guardado (crear, restaurar o borrar versiones).
  useEffect(() => {
    if (!open) return
    let cancelled = false
    api.listVersions(prompt.id).then(
      (list) => !cancelled && setVersions(list),
      () => !cancelled && setVersions([]),
    )
    return () => {
      cancelled = true
    }
  }, [open, prompt.id, prompt.versionCount, prompt.updatedAt])

  return (
    <section className="history">
      <header className="history-header">
        <button type="button" className="history-toggle" aria-expanded={open} onClick={() => setOpen(!open)}>
          <History size={16} aria-hidden />
          <span>Historial de versiones</span>
          <span className="variables-count">{prompt.versionCount}</span>
          <ChevronDown size={15} className="history-chevron" aria-hidden />
        </button>
        <Button size="sm" variant="ghost" icon={<Plus size={14} />} onClick={() => openDialog({ type: 'version', promptId: prompt.id })}>
          Crear versión
        </Button>
      </header>

      {open && (
        <div className="history-body">
          {versions === null && <p className="history-empty">Cargando…</p>}
          {versions?.length === 0 && (
            <p className="history-empty">
              Aún no hay versiones guardadas. Crea una antes de hacer cambios grandes y podrás volver a este punto cuando quieras.
            </p>
          )}
          {versions && versions.length > 0 && (
            <ul className="version-list">
              {versions.map((version) => (
                <VersionItem key={version.id} prompt={prompt} version={version} />
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  )
}
