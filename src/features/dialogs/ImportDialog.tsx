import { useState, type DragEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { ClipboardPaste, FileUp } from 'lucide-react'
import { api } from '@/api/client'
import { pickTextFile, readFileAsText, type PickedFile } from '@/api/platform'
import { Button } from '@/components/Button'
import { Dialog } from '@/components/Dialog'
import { useLibrary } from '@/store/library'
import { attempt, useUi } from '@/store/ui'
import { pluralize } from '@shared/text'
import type { ImportPreview } from '@shared/types'

type Tab = 'text' | 'file'

interface PreviewState {
  file: PickedFile
  preview: ImportPreview
  selected: Set<string>
  asSingle: boolean
}

const ACCEPT = '.json,.csv,.md,.markdown,.txt,application/json,text/csv,text/markdown,text/plain'
const SOURCE_LABEL = { json: 'JSON', csv: 'CSV', markdown: 'Markdown', text: 'Texto' } as const

export function ImportDialog() {
  const close = useUi((s) => s.closeDialog)
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>('file')
  const [text, setText] = useState('')
  const [dragging, setDragging] = useState(false)
  const [busy, setBusy] = useState(false)
  const [state, setState] = useState<PreviewState | null>(null)

  const analyze = async (file: PickedFile, asSingle: boolean) => {
    setBusy(true)
    const preview = await attempt(() => api.previewImport({ kind: 'file', filename: file.name, content: file.content, asSingle }))
    setBusy(false)
    if (!preview) return
    setState({ file, preview, asSingle, selected: new Set(preview.candidates.filter((c) => c.status === 'new').map((c) => c.key)) })
  }

  const choose = async () => {
    const file = await attempt(() => pickTextFile(ACCEPT))
    if (file) await analyze(file, false)
  }

  const onDrop = async (event: DragEvent) => {
    event.preventDefault()
    setDragging(false)
    const dropped = event.dataTransfer.files[0]
    if (!dropped) return
    const file = await attempt(() => readFileAsText(dropped))
    if (file) await analyze(file, false)
  }

  const commit = async () => {
    if (!state) return
    const chosen = state.preview.candidates.filter((c) => state.selected.has(c.key))
    setBusy(true)
    const result = await attempt(async () => {
      const outcome = await api.commitImport(chosen)
      await useLibrary.getState().load()
      await useLibrary.getState().markWelcomeDone()
      return outcome
    })
    setBusy(false)
    if (result) {
      useUi.getState().toast(`Importado: ${pluralize(result.imported, 'prompt', 'prompts')}`)
      close()
      navigate('/library')
    }
  }

  const toggle = (key: string) => {
    if (!state) return
    const selected = new Set(state.selected)
    if (!selected.delete(key)) selected.add(key)
    setState({ ...state, selected })
  }

  const continueInEditor = () => {
    close()
    navigate('/new', { state: { content: text } })
  }

  /* ----------------------------- vista previa ----------------------------- */
  if (state) {
    const { preview, selected, file, asSingle } = state
    const duplicates = preview.candidates.filter((c) => c.status === 'duplicate').length
    const allSelected = selected.size === preview.candidates.length
    return (
      <Dialog
        size="lg"
        title="Revisa lo que se va a importar"
        description={`${file.name} · ${SOURCE_LABEL[preview.source]} · ${pluralize(preview.candidates.length, 'prompt encontrado', 'prompts encontrados')}`}
        onClose={close}
        dismissible={!busy}
        footer={
          <>
            <Button variant="ghost" className="spacer" onClick={() => setState(null)} disabled={busy}>
              Elegir otro archivo
            </Button>
            <Button variant="ghost" onClick={close} disabled={busy}>
              Cancelar
            </Button>
            <Button variant="primary" onClick={() => void commit()} loading={busy} disabled={selected.size === 0}>
              Importar {pluralize(selected.size, 'prompt', 'prompts')}
            </Button>
          </>
        }
      >
        {preview.source === 'markdown' && (preview.candidates.length > 1 || asSingle) && (
          <label className="check-row import-option">
            <input
              type="checkbox"
              className="checkbox"
              checked={asSingle}
              disabled={busy}
              onChange={(e) => void analyze(file, e.target.checked)}
            />
            Tratar el archivo completo como un único prompt (no dividir por títulos)
          </label>
        )}
        {(duplicates > 0 || preview.skipped > 0) && (
          <p className="import-note">
            {duplicates > 0 && (
              <>
                {pluralize(duplicates, 'ya existe en tu biblioteca y viene desmarcado', 'ya existen en tu biblioteca y vienen desmarcados')}
                .{' '}
              </>
            )}
            {preview.skipped > 0 && (
              <>{pluralize(preview.skipped, 'elemento sin contenido se ha omitido', 'elementos sin contenido se han omitido')}.</>
            )}
          </p>
        )}
        {preview.warnings.map((warning) => (
          <p key={warning} className="import-note">
            {warning}
          </p>
        ))}
        <div className="import-list-header">
          <label className="check-row">
            <input
              type="checkbox"
              className="checkbox"
              checked={allSelected}
              onChange={() => setState({ ...state, selected: allSelected ? new Set() : new Set(preview.candidates.map((c) => c.key)) })}
            />
            Seleccionar todo
          </label>
        </div>
        <ul className="import-list">
          {preview.candidates.map((candidate) => (
            <li key={candidate.key}>
              <label className="import-row">
                <input type="checkbox" className="checkbox" checked={selected.has(candidate.key)} onChange={() => toggle(candidate.key)} />
                <span className="import-row-main">
                  <span className="import-row-title truncate">{candidate.title}</span>
                  <span className="import-row-sub truncate">
                    {[
                      candidate.categoryName,
                      candidate.projectName,
                      candidate.toolName,
                      candidate.tags.length > 0 ? candidate.tags.map((t) => `#${t}`).join(' ') : null,
                    ]
                      .filter(Boolean)
                      .join(' · ') || candidate.content.replace(/\s+/g, ' ').slice(0, 90)}
                  </span>
                </span>
                {candidate.status === 'duplicate' && <span className="chip">Ya existe</span>}
              </label>
            </li>
          ))}
        </ul>
      </Dialog>
    )
  }

  /* ------------------------------ elegir origen ------------------------------ */
  return (
    <Dialog
      size="md"
      title="Importar prompts"
      description="Trae tus prompts desde un archivo o pega uno directamente."
      onClose={close}
      footer={
        tab === 'text' ? (
          <>
            <Button variant="ghost" onClick={close}>
              Cancelar
            </Button>
            <Button variant="primary" onClick={continueInEditor} disabled={text.trim().length === 0}>
              Continuar en el editor
            </Button>
          </>
        ) : (
          <Button variant="ghost" onClick={close}>
            Cancelar
          </Button>
        )
      }
    >
      <div className="import-tabs">
        <button type="button" className={`import-tab${tab === 'file' ? ' is-selected' : ''}`} onClick={() => setTab('file')}>
          <FileUp size={16} aria-hidden /> Desde un archivo
        </button>
        <button type="button" className={`import-tab${tab === 'text' ? ' is-selected' : ''}`} onClick={() => setTab('text')}>
          <ClipboardPaste size={16} aria-hidden /> Pegar texto
        </button>
      </div>

      {tab === 'file' ? (
        <div
          className={`dropzone${dragging ? ' is-dragging' : ''}`}
          onDragOver={(event) => {
            event.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => void onDrop(event)}
        >
          <FileUp size={26} aria-hidden />
          <p className="dropzone-title">Arrastra un archivo aquí</p>
          <p className="dropzone-hint">JSON (backup o lista), CSV, Markdown o TXT</p>
          <Button variant="secondary" onClick={() => void choose()} loading={busy}>
            Elegir archivo…
          </Button>
        </div>
      ) : (
        <label className="field">
          <span className="field-label">Prompt</span>
          <textarea
            className="textarea import-textarea"
            rows={9}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Pega aquí tu prompt. En el siguiente paso podrás ponerle título, categoría y etiquetas."
          />
        </label>
      )}
    </Dialog>
  )
}
