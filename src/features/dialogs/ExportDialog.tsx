import { useState } from 'react'
import { Braces, FileText, Table2, Type } from 'lucide-react'
import { Button } from '@/components/Button'
import { Dialog } from '@/components/Dialog'
import { useLibrary } from '@/store/library'
import { useUi } from '@/store/ui'
import { pluralize } from '@shared/text'
import type { ExportFormat } from '@shared/types'
import { runExport } from '../data/actions'

const FORMATS: { value: ExportFormat; label: string; detail: string; icon: typeof FileText }[] = [
  { value: 'json', label: 'JSON', detail: 'Completo, con versiones y uso. Ideal para copias de seguridad.', icon: Braces },
  { value: 'csv', label: 'CSV', detail: 'Tabla para Excel o Google Sheets.', icon: Table2 },
  { value: 'markdown', label: 'Markdown', detail: 'Legible y fácil de importar de nuevo.', icon: FileText },
  { value: 'txt', label: 'Texto', detail: 'Texto plano para leer o imprimir.', icon: Type },
]

/** Exporta toda la biblioteca o una selección de prompts. */
export function ExportDialog({ ids }: { ids?: string[] }) {
  const close = useUi((s) => s.closeDialog)
  const total = useLibrary((s) => s.prompts.length)
  const [format, setFormat] = useState<ExportFormat>('json')
  const [saving, setSaving] = useState(false)
  const count = ids ? ids.length : total

  const submit = async () => {
    setSaving(true)
    const saved = await runExport({ format, ids })
    setSaving(false)
    if (saved) close()
  }

  return (
    <Dialog
      size="md"
      title="Exportar"
      description={
        ids
          ? `${pluralize(count, 'prompt seleccionado', 'prompts seleccionados')}.`
          : `Toda tu biblioteca: ${pluralize(count, 'prompt', 'prompts')} (incluye archivados).`
      }
      onClose={close}
      dismissible={!saving}
      footer={
        <>
          <Button variant="ghost" onClick={close} disabled={saving}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={() => void submit()} loading={saving} disabled={count === 0}>
            Exportar
          </Button>
        </>
      }
    >
      <div className="format-grid" role="radiogroup" aria-label="Formato de exportación">
        {FORMATS.map(({ value, label, detail, icon: Icon }) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={format === value}
            className={`format-card${format === value ? ' is-selected' : ''}`}
            onClick={() => setFormat(value)}
          >
            <Icon size={18} aria-hidden />
            <span className="format-card-label">{label}</span>
            <span className="format-card-detail">{detail}</span>
          </button>
        ))}
      </div>
    </Dialog>
  )
}
