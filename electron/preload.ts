import { contextBridge, ipcRenderer } from 'electron'
import type { VaultBridge } from '@shared/bridge'

/** Único punto de contacto entre la interfaz (aislada y sin Node) y el proceso principal. */
const bridge: VaultBridge = {
  rpc: (method, args) => ipcRenderer.invoke('vault:rpc', method, args),
  copyText: (text) => ipcRenderer.invoke('platform:copy', text),
  saveFile: (request) => ipcRenderer.invoke('platform:save-file', request),
  setTheme: (theme) => ipcRenderer.invoke('platform:set-theme', theme),
  revealData: () => ipcRenderer.invoke('platform:reveal-data'),
  platform: process.platform,
}

contextBridge.exposeInMainWorld('vaultBridge', bridge)
