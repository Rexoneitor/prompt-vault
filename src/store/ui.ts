import { create } from 'zustand'
import { errorMessage } from '@/api/client'
import { setNativeTheme } from '@/api/platform'
import { readPref, writePref } from '@/utils/prefs'
import type { ThemeChoice } from '@shared/bridge'
import type { Id } from '@shared/types'

export type ViewMode = 'list' | 'grid'
export type ToastKind = 'success' | 'error' | 'info'

export interface Toast {
  id: number
  kind: ToastKind
  message: string
  action?: { label: string; run: () => void }
}

export interface ConfirmOptions {
  title: string
  message?: string
  confirmLabel: string
  danger?: boolean
  /** Tercera salida (p. ej. «Archivar en su lugar»). */
  alternativeLabel?: string
}

export type ConfirmAnswer = 'confirm' | 'alternative' | 'cancel'

export type DialogState =
  | { type: 'category'; id?: Id }
  | { type: 'project'; id?: Id }
  | { type: 'tool'; id?: Id }
  | { type: 'version'; promptId: Id }
  | { type: 'import' }
  | { type: 'export'; ids?: Id[] }
  | { type: 'shortcuts' }

const isTheme = (value: unknown): value is ThemeChoice => value === 'light' || value === 'dark' || value === 'system'
const isView = (value: unknown): value is ViewMode => value === 'list' || value === 'grid'
const isFlags = (value: unknown): value is Record<string, boolean> => typeof value === 'object' && value !== null && !Array.isArray(value)

function applyTheme(theme: ThemeChoice): void {
  if (theme === 'system') delete document.documentElement.dataset.theme
  else document.documentElement.dataset.theme = theme
  setNativeTheme(theme)
}

interface UiState {
  theme: ThemeChoice
  viewMode: ViewMode
  collapsedSections: Record<string, boolean>
  paletteOpen: boolean
  drawerOpen: boolean
  toasts: Toast[]
  confirmRequest: { options: ConfirmOptions; resolve: (answer: ConfirmAnswer) => void } | null
  dialog: DialogState | null

  setTheme(theme: ThemeChoice): void
  setViewMode(mode: ViewMode): void
  toggleSection(key: string, defaultCollapsed?: boolean): void
  setPaletteOpen(open: boolean): void
  setDrawerOpen(open: boolean): void
  toast(message: string, kind?: ToastKind, action?: Toast['action']): void
  dismissToast(id: number): void
  confirm(options: ConfirmOptions): Promise<ConfirmAnswer>
  resolveConfirm(answer: ConfirmAnswer): void
  openDialog(dialog: DialogState): void
  closeDialog(): void
}

let toastSeq = 0

export const useUi = create<UiState>((set, get) => ({
  theme: readPref('theme', 'system', isTheme),
  viewMode: readPref('view', 'grid', isView),
  collapsedSections: readPref('sections', {}, isFlags),
  paletteOpen: false,
  drawerOpen: false,
  toasts: [],
  confirmRequest: null,
  dialog: null,

  setTheme(theme) {
    applyTheme(theme)
    writePref('theme', theme)
    set({ theme })
  },

  setViewMode(viewMode) {
    writePref('view', viewMode)
    set({ viewMode })
  },

  toggleSection(key, defaultCollapsed = false) {
    const current = get().collapsedSections
    const next = { ...current, [key]: !(current[key] ?? defaultCollapsed) }
    writePref('sections', next)
    set({ collapsedSections: next })
  },

  setPaletteOpen: (paletteOpen) => set({ paletteOpen }),
  setDrawerOpen: (drawerOpen) => set({ drawerOpen }),

  toast(message, kind = 'success', action) {
    const id = ++toastSeq
    set((state) => ({ toasts: [...state.toasts.slice(-3), { id, kind, message, action }] }))
    setTimeout(() => get().dismissToast(id), action ? 7000 : kind === 'error' ? 6000 : 2800)
  },

  dismissToast: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),

  confirm(options) {
    return new Promise((resolve) => {
      get().confirmRequest?.resolve('cancel')
      set({ confirmRequest: { options, resolve } })
    })
  },

  resolveConfirm(answer) {
    get().confirmRequest?.resolve(answer)
    set({ confirmRequest: null })
  },

  openDialog: (dialog) => set({ dialog }),
  closeDialog: () => set({ dialog: null }),
}))

/** Aplica el tema guardado al arrancar (el script de index.html ya lo hizo antes del primer pintado). */
export function initTheme(): void {
  applyTheme(useUi.getState().theme)
}

/**
 * Ejecuta una operación y convierte cualquier fallo en un aviso claro.
 * Devuelve `undefined` si falló, para que el llamador pueda seguir sin try/catch.
 */
export async function attempt<T>(work: () => Promise<T>, successMessage?: string): Promise<T | undefined> {
  try {
    const result = await work()
    if (successMessage) useUi.getState().toast(successMessage)
    return result
  } catch (error) {
    useUi.getState().toast(errorMessage(error), 'error')
    return undefined
  }
}
