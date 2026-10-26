import { useState } from 'react'
import { Braces, ChevronDown } from 'lucide-react'
import { hasFilledValues, type VariableValues } from '@shared/variables'

interface VariablesPanelProps {
  names: string[]
  values: VariableValues
  onChange: (values: VariableValues) => void
}

/**
 * Plantilla con variables: cerrado por defecto para no estorbar al copiado normal.
 * Mientras haya valores, el prompt de la pantalla (y lo que se copia) ya va completado.
 */
export function VariablesPanel({ names, values, onChange }: VariablesPanelProps) {
  const filled = hasFilledValues(values)
  const [open, setOpen] = useState(false)
  const expanded = open || filled
  const done = names.filter((name) => values[name]).length

  return (
    <section className={`variables${expanded ? ' is-open' : ''}`} aria-label="Variables del prompt">
      <button type="button" className="variables-toggle" aria-expanded={expanded} onClick={() => setOpen(!expanded)}>
        <Braces size={16} aria-hidden />
        <span className="variables-title">
          Variables <span className="variables-count">{names.length}</span>
        </span>
        <span className="variables-hint">
          {filled
            ? `${done} de ${names.length} completadas · se copiará ya rellenado`
            : 'Complétalas para copiar el prompt listo para usar'}
        </span>
        <ChevronDown size={16} className="variables-chevron" aria-hidden />
      </button>

      {expanded && (
        <div className="variables-body">
          <div className="variables-grid">
            {names.map((name) => (
              <label key={name} className="field">
                <span className="field-label var-name">{`{{${name}}}`}</span>
                <textarea
                  className="textarea variable-input"
                  rows={1}
                  value={values[name] ?? ''}
                  placeholder={name.replace(/[_-]+/g, ' ')}
                  onChange={(event) => onChange({ ...values, [name]: event.target.value })}
                />
              </label>
            ))}
          </div>
          {filled && (
            <button type="button" className="variables-clear" onClick={() => onChange({})}>
              Vaciar valores
            </button>
          )}
        </div>
      )}
    </section>
  )
}
