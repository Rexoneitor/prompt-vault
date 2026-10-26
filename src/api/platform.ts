import type { SaveFileRequest, SaveFileResult, ThemeChoice, VaultBridge } from '@shared/bridge'

declare global {
  interface Window {
    /** Solo existe dentro de Electron (lo inyecta el preload). */
    vaultBridge?: VaultBridge
  }
}

const bridge = window.vaultBridge

/** ¿Corre dentro de la app de escritorio? (si no, es el modo web local). */
export const isDesktop = bridge !== undefined

export const isMac = /mac|darwin/i.test(bridge?.platform ?? navigator.platform ?? '')

/** Nombre de la tecla modificadora principal para mostrar en atajos. */
export const modKeyLabel = isMac ? '⌘' : 'Ctrl'

export async function copyText(text: string): Promise<void> {
  if (bridge) return bridge.copyText(text)
  try {
    await navigator.clipboard.writeText(text)
  } catch {
    // Contexto sin Clipboard API: recurso clásico mediante un textarea temporal.
    const area = document.createElement('textarea')
    area.value = text
    area.style.cssText = 'position:fixed;opacity:0;pointer-events:none'
    document.body.append(area)
    area.select()
    const ok = document.execCommand('copy')
    area.remove()
    if (!ok) throw new Error('No se pudo copiar al portapapeles.')
  }
}

/** Guarda un archivo: diálogo nativo en escritorio, descarga en el navegador. */
export async function saveFile(request: SaveFileRequest): Promise<SaveFileResult> {
  if (bridge) return bridge.saveFile(request)
  const url = URL.createObjectURL(new Blob([request.content], { type: request.mimeType }))
  const link = document.createElement('a')
  link.href = url
  link.download = request.filename
  document.body.append(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
  return { saved: true }
}

export function setNativeTheme(theme: ThemeChoice): void {
  void bridge?.setTheme(theme)
}

export function revealDataFolder(): void {
  void bridge?.revealData()
}

export interface PickedFile {
  name: string
  content: string
}

export function readFileAsText(file: File): Promise<PickedFile> {
  return file.text().then((content) => ({ name: file.name, content }))
}

/** Abre el selector de archivos del sistema y devuelve el contenido como texto (null si se cancela). */
export function pickTextFile(accept: string): Promise<PickedFile | null> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = accept
    input.addEventListener('change', () => {
      const file = input.files?.[0]
      if (!file) return resolve(null)
      readFileAsText(file).then(resolve, reject)
    })
    input.addEventListener('cancel', () => resolve(null))
    input.click()
  })
}
