import type { SelectHTMLAttributes } from 'react'
import { ChevronDown } from 'lucide-react'

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  options: { value: string; label: string }[]
  wrapperClassName?: string
}

/** `<select>` nativo (accesible y cómodo en móvil) con el aspecto de la aplicación. */
export function Select({ options, className, wrapperClassName, ...rest }: SelectProps) {
  return (
    <span className={`select-wrap${wrapperClassName ? ` ${wrapperClassName}` : ''}`}>
      <select className={`select${className ? ` ${className}` : ''}`} {...rest}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown size={15} aria-hidden />
    </span>
  )
}
