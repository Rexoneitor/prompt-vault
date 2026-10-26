import type { ButtonHTMLAttributes, ReactNode, Ref } from 'react'
import { Loader2 } from 'lucide-react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md' | 'lg'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  icon?: ReactNode
  loading?: boolean
  ref?: Ref<HTMLButtonElement>
}

export function Button({
  variant = 'secondary',
  size = 'md',
  icon,
  loading,
  children,
  className,
  disabled,
  ref,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      ref={ref}
      type={type}
      className={`btn btn-${variant} btn-${size}${className ? ` ${className}` : ''}`}
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? <Loader2 className="spin" size={size === 'lg' ? 18 : 15} aria-hidden /> : icon}
      {children !== undefined && children !== null && <span className="btn-label">{children}</span>}
    </button>
  )
}

interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'aria-label'> {
  label: string
  active?: boolean
  size?: 'sm' | 'md'
  tipSide?: 'top' | 'bottom' | 'left' | 'right'
  ref?: Ref<HTMLButtonElement>
}

/** Botón solo-icono: la etiqueta sirve de nombre accesible y de tooltip. */
export function IconButton({ label, active, size = 'md', tipSide, className, children, ref, type = 'button', ...rest }: IconButtonProps) {
  return (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      data-tip={label}
      data-tip-side={tipSide}
      aria-pressed={active}
      className={`icon-btn icon-btn-${size}${active ? ' is-active' : ''}${className ? ` ${className}` : ''}`}
      {...rest}
    >
      {children}
    </button>
  )
}
