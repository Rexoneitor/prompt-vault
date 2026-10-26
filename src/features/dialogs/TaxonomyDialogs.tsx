import { useState, type FormEvent } from 'react'
import { Check } from 'lucide-react'
import { Button } from '@/components/Button'
import { Dialog } from '@/components/Dialog'
import { useLibrary } from '@/store/library'
import { attempt, useUi } from '@/store/ui'
import { CATEGORY_COLORS, DEFAULT_CATEGORY_COLOR } from '@shared/palette'

const FORM_ID = 'taxonomy-form'

interface ShellProps {
  title: string
  description?: string
  saving: boolean
  isEdit: boolean
  onSubmit: () => void
  children: React.ReactNode
}

function FormDialog({ title, description, saving, isEdit, onSubmit, children }: ShellProps) {
  const close = useUi((s) => s.closeDialog)
  return (
    <Dialog
      size="sm"
      title={title}
      description={description}
      onClose={close}
      dismissible={!saving}
      footer={
        <>
          <Button variant="ghost" onClick={close} disabled={saving}>
            Cancelar
          </Button>
          <Button variant="primary" type="submit" form={FORM_ID} loading={saving}>
            {isEdit ? 'Guardar cambios' : 'Crear'}
          </Button>
        </>
      }
    >
      <form
        id={FORM_ID}
        className="form-grid"
        onSubmit={(event: FormEvent) => {
          event.preventDefault()
          onSubmit()
        }}
      >
        {children}
      </form>
    </Dialog>
  )
}

/* -------------------------------- Categoría -------------------------------- */

export function CategoryDialog({ id }: { id?: string }) {
  const close = useUi((s) => s.closeDialog)
  const existing = useLibrary((s) => s.categories.find((c) => c.id === id))
  const count = useLibrary((s) => s.categories.length)
  const [name, setName] = useState(existing?.name ?? '')
  const [color, setColor] = useState(existing?.color ?? CATEGORY_COLORS[count % CATEGORY_COLORS.length] ?? DEFAULT_CATEGORY_COLOR)
  const [saving, setSaving] = useState(false)

  const submit = async () => {
    setSaving(true)
    const { createCategory, updateCategory } = useLibrary.getState()
    const saved = await attempt(
      async () => {
        if (existing) await updateCategory(existing.id, { name, color })
        else await createCategory({ name, color })
        return true
      },
      existing ? 'Categoría actualizada' : 'Categoría creada',
    )
    setSaving(false)
    if (saved) close()
  }

  return (
    <FormDialog title={existing ? 'Editar categoría' : 'Nueva categoría'} saving={saving} isEdit={Boolean(existing)} onSubmit={submit}>
      <label className="field">
        <span className="field-label">Nombre</span>
        <input className="input" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} placeholder="p. ej. Ventas" />
      </label>
      <div className="field">
        <span className="field-label">Color</span>
        <div className="swatches" role="radiogroup" aria-label="Color de la categoría">
          {CATEGORY_COLORS.map((option) => (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={option === color}
              aria-label={option}
              className={`swatch${option === color ? ' is-selected' : ''}`}
              style={{ background: `var(--cat-${option})` }}
              onClick={() => setColor(option)}
            >
              {option === color && <Check size={13} strokeWidth={3} />}
            </button>
          ))}
        </div>
      </div>
    </FormDialog>
  )
}

/* -------------------------------- Proyecto -------------------------------- */

export function ProjectDialog({ id }: { id?: string }) {
  const close = useUi((s) => s.closeDialog)
  const existing = useLibrary((s) => s.projects.find((p) => p.id === id))
  const [name, setName] = useState(existing?.name ?? '')
  const [description, setDescription] = useState(existing?.description ?? '')
  const [saving, setSaving] = useState(false)

  const submit = async () => {
    setSaving(true)
    const { createProject, updateProject } = useLibrary.getState()
    const saved = await attempt(
      async () => {
        if (existing) await updateProject(existing.id, { name, description })
        else await createProject({ name, description })
        return true
      },
      existing ? 'Proyecto actualizado' : 'Proyecto creado',
    )
    setSaving(false)
    if (saved) close()
  }

  return (
    <FormDialog
      title={existing ? 'Editar proyecto' : 'Nuevo proyecto'}
      description="Reúne todos los prompts de un trabajo concreto, sea cual sea su categoría."
      saving={saving}
      isEdit={Boolean(existing)}
      onSubmit={submit}
    >
      <label className="field">
        <span className="field-label">Nombre</span>
        <input
          className="input"
          value={name}
          maxLength={80}
          onChange={(e) => setName(e.target.value)}
          placeholder="p. ej. CRM Agencia de Viajes"
        />
      </label>
      <label className="field">
        <span className="field-label">Descripción (opcional)</span>
        <textarea className="textarea" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
      </label>
    </FormDialog>
  )
}

/* ------------------------------- Herramienta ------------------------------- */

export function ToolDialog({ id }: { id?: string }) {
  const close = useUi((s) => s.closeDialog)
  const existing = useLibrary((s) => s.tools.find((t) => t.id === id))
  const [name, setName] = useState(existing?.name ?? '')
  const [saving, setSaving] = useState(false)

  const submit = async () => {
    setSaving(true)
    const { createTool, updateTool } = useLibrary.getState()
    const saved = await attempt(
      async () => {
        if (existing) await updateTool(existing.id, { name })
        else await createTool({ name })
        return true
      },
      existing ? 'Herramienta actualizada' : 'Herramienta añadida',
    )
    setSaving(false)
    if (saved) close()
  }

  return (
    <FormDialog
      title={existing ? 'Editar herramienta' : 'Nueva herramienta'}
      description="La IA o aplicación para la que está pensado un prompt."
      saving={saving}
      isEdit={Boolean(existing)}
      onSubmit={submit}
    >
      <label className="field">
        <span className="field-label">Nombre</span>
        <input className="input" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} placeholder="p. ej. Grok" />
      </label>
    </FormDialog>
  )
}
