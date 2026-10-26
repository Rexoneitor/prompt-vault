import type { RpcResult } from './errors'

export type ThemeChoice = 'light' | 'dark' | 'system'

export interface SaveFileRequest {
  filename: string
  content: string
  mimeType: string
}

export interface SaveFileResult {
  saved: boolean
  /** Ruta elegida por el usuario (solo en escritorio). */
  path?: string
}

/**
 * Capacidades nativas que expone el proceso principal de Electron a la interfaz
 * (`window.vaultBridge`). En el navegador no existe y la interfaz usa APIs web equivalentes.
 */
export interface VaultBridge {
  rpc(method: string, args: unknown[]): Promise<RpcResult>
  copyText(text: string): Promise<void>
  saveFile(request: SaveFileRequest): Promise<SaveFileResult>
  setTheme(theme: ThemeChoice): Promise<void>
  revealData(): Promise<void>
  readonly platform: string
}
