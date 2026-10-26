import type { ReactNode } from 'react'

interface Option<T extends string> {
  value: T
  label: string
  icon?: ReactNode
}

interface SegmentedControlProps<T extends string> {
  label: string
  value: T
  options: Option<T>[]
  onChange: (value: T) => void
  /** Solo muestra los iconos (las etiquetas quedan como texto accesible). */
  iconOnly?: boolean
}

export function SegmentedControl<T extends string>({ label, value, options, onChange, iconOnly }: SegmentedControlProps<T>) {
  return (
    <div className="segmented" role="radiogroup" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={option.value === value}
          aria-label={iconOnly ? option.label : undefined}
          data-tip={iconOnly ? option.label : undefined}
          className={`segmented-option${option.value === value ? ' is-selected' : ''}`}
          onClick={() => onChange(option.value)}
        >
          {option.icon}
          {!iconOnly && <span>{option.label}</span>}
        </button>
      ))}
    </div>
  )
}
