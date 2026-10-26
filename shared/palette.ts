/** Claves de color para categorías. Los valores reales viven en CSS (`--cat-<clave>`), uno por tema. */
export const CATEGORY_COLORS = ['slate', 'rose', 'orange', 'amber', 'lime', 'emerald', 'teal', 'sky', 'indigo', 'violet', 'pink'] as const

export type CategoryColor = (typeof CATEGORY_COLORS)[number]

export const DEFAULT_CATEGORY_COLOR: CategoryColor = 'slate'

export function isCategoryColor(value: string): value is CategoryColor {
  return (CATEGORY_COLORS as readonly string[]).includes(value)
}
