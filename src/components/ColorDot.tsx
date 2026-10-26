/** Punto de color de una categoría (`color` es la clave de la paleta). */
export function ColorDot({ color, size = 9 }: { color: string; size?: number }) {
  return (
    <span className="color-dot" style={{ width: size, height: size, background: `var(--cat-${color}, var(--cat-slate))` }} aria-hidden />
  )
}
