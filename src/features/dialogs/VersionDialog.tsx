import { useState } from 'react'
import { Button } from '@/components/Button'
import { Dialog } from '@/components/Dialog'
import { useLibrary } from '@/store/library'
import { attempt, useUi } from '@/store/ui'

/** Guarda una instantánea del contenido actual del prompt como una nueva versión. */
export function VersionDialog({ promptId }: { promptId: string }) {
  const close = useUi((s) => s.closeDialog)
  const prompt = useLibrary((s) => s.prompts.find((p) => p.id === promptId))
  const [name, setName] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  if (!prompt) return null

  const submit = async () => {
    setSaving(true)
    const saved = await attempt(async () => {
      const version = await useLibrary.getState().createVersion(promptId, { name, notes })
      return version.version
    })
    setSaving(false)
    if (saved !== undefined) {
      useUi.getState().toast(`Versión ${saved} guardada`)
      close()
    }
  }

  return (
    <Dialog
      size="sm"
      title="Crear versión"
      description="Guarda el estado actual del prompt en el historial. Podrás volver a él cuando quieras."
      onClose={close}
      dismissible={!saving}
      footer={
        <>
          <Button variant="ghost" onClick={close} disabled={saving}>
            Cancelar
          </Button>
          <Button variant="primary" type="submit" form="version-form" loading={saving}>
            Guardar versión
          </Button>
        </>
      }
    >
      <form
        id="version-form"
        className="form-grid"
        onSubmit={(event) => {
          event.preventDefault()
          void submit()
        }}
      >
        <label className="field">
          <span className="field-label">Nombre (opcional)</span>
          <input
            className="input"
            value={name}
            maxLength={80}
            onChange={(e) => setName(e.target.value)}
            placeholder="p. ej. Tono más cercano"
          />
        </label>
        <label className="field">
          <span className="field-label">Notas sobre los cambios (opcional)</span>
          <textarea
            className="textarea"
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="¿Qué has mejorado o por qué guardas esta versión?"
          />
        </label>
        <p className="field-hint">
          {prompt.versionCount === 0
            ? 'Será la primera versión de este prompt.'
            : `Este prompt ya tiene ${prompt.versionCount} versión${prompt.versionCount === 1 ? '' : 'es'} guardada${prompt.versionCount === 1 ? '' : 's'}.`}
        </p>
      </form>
    </Dialog>
  )
}
