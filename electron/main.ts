import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { writeFile } from 'node:fs/promises'
import { extname, join } from 'node:path'
import {
  BrowserWindow,
  Menu,
  app,
  clipboard,
  dialog,
  ipcMain,
  nativeTheme,
  session,
  shell,
  type IpcMainInvokeEvent,
  type MenuItemConstructorOptions,
} from 'electron'
import { createVault, type Vault } from '@backend/vault'
import { dispatchRpc } from '@backend/rpc'
import type { SaveFileRequest, SaveFileResult, ThemeChoice } from '@shared/bridge'

const DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL
const isMac = process.platform === 'darwin'

app.setName('Prompt Vault')
// Permite aislar los datos (pruebas, perfiles distintos) sin tocar la biblioteca real.
if (process.env.PV_DATA_DIR) app.setPath('userData', process.env.PV_DATA_DIR)

let vault: Vault | null = null
let mainWindow: BrowserWindow | null = null

/* ------------------------------ Estado de la ventana ------------------------------ */

interface WindowState {
  width: number
  height: number
  x?: number
  y?: number
  maximized?: boolean
}

const stateFile = () => join(app.getPath('userData'), 'window-state.json')

function loadWindowState(): WindowState {
  try {
    return { width: 1280, height: 820, ...JSON.parse(readFileSync(stateFile(), 'utf8')) }
  } catch {
    return { width: 1280, height: 820 }
  }
}

function saveWindowState(win: BrowserWindow): void {
  try {
    const maximized = win.isMaximized()
    const bounds = maximized ? win.getNormalBounds() : win.getBounds()
    writeFileSync(stateFile(), JSON.stringify({ ...bounds, maximized }))
  } catch {
    // Recordar el tamaño es solo una comodidad; nunca debe romper el cierre.
  }
}

/* ------------------------------------ Seguridad ------------------------------------ */

function isTrustedSender(event: IpcMainInvokeEvent): boolean {
  const url = event.senderFrame?.url ?? ''
  return DEV_SERVER_URL ? url.startsWith(DEV_SERVER_URL) : url.startsWith('file://')
}

function guard<T extends unknown[], R>(handler: (...args: T) => R | Promise<R>) {
  return (event: IpcMainInvokeEvent, ...args: T): R | Promise<R> => {
    if (!isTrustedSender(event)) throw new Error('Origen no autorizado.')
    return handler(...args)
  }
}

function lockDownSession(): void {
  // La app no necesita ningún permiso del navegador (el portapapeles va por IPC).
  session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false))
  session.defaultSession.setPermissionCheckHandler(() => false)
}

/* ------------------------------------ IPC ------------------------------------ */

function registerIpc(): void {
  ipcMain.handle(
    'vault:rpc',
    guard((method: unknown, args: unknown) => dispatchRpc(vault!.api, method, args)),
  )

  ipcMain.handle(
    'platform:copy',
    guard((text: unknown) => {
      if (typeof text === 'string') clipboard.writeText(text)
    }),
  )

  ipcMain.handle(
    'platform:save-file',
    guard(async (request: SaveFileRequest): Promise<SaveFileResult> => {
      const extension = extname(request.filename).slice(1)
      const result = await dialog.showSaveDialog(mainWindow ?? BrowserWindow.getFocusedWindow()!, {
        defaultPath: join(app.getPath('documents'), request.filename),
        filters: extension ? [{ name: extension.toUpperCase(), extensions: [extension] }] : [],
      })
      if (result.canceled || !result.filePath) return { saved: false }
      await writeFile(result.filePath, request.content, 'utf8')
      return { saved: true, path: result.filePath }
    }),
  )

  ipcMain.handle(
    'platform:set-theme',
    guard((theme: ThemeChoice) => {
      if (theme === 'light' || theme === 'dark' || theme === 'system') nativeTheme.themeSource = theme
    }),
  )

  ipcMain.handle(
    'platform:reveal-data',
    guard(() => {
      const database = join(app.getPath('userData'), 'vault.db')
      if (existsSync(database)) shell.showItemInFolder(database)
      else void shell.openPath(app.getPath('userData'))
    }),
  )
}

/* ------------------------------------ Ventana ------------------------------------ */

const ZOOM_STEP = 0.5

function installShortcuts(win: BrowserWindow): void {
  win.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return
    const mod = isMac ? input.meta : input.control
    if (DEV_SERVER_URL && (input.key === 'F12' || (mod && input.shift && input.key.toLowerCase() === 'i'))) {
      win.webContents.toggleDevTools()
      event.preventDefault()
      return
    }
    if (!mod) return
    const contents = win.webContents
    if (input.key === '=' || input.key === '+') contents.setZoomLevel(contents.getZoomLevel() + ZOOM_STEP)
    else if (input.key === '-') contents.setZoomLevel(contents.getZoomLevel() - ZOOM_STEP)
    else if (input.key === '0') contents.setZoomLevel(0)
    else return
    event.preventDefault()
  })
}

function createWindow(): void {
  const state = loadWindowState()
  const win = new BrowserWindow({
    width: state.width,
    height: state.height,
    x: state.x,
    y: state.y,
    minWidth: 360,
    minHeight: 520,
    show: false,
    title: 'Prompt Vault',
    autoHideMenuBar: true,
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#121211' : '#f7f6f3',
    webPreferences: {
      preload: join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      spellcheck: false,
    },
  })
  mainWindow = win
  if (state.maximized) win.maximize()
  win.once('ready-to-show', () => win.show())
  win.on('close', () => saveWindowState(win))
  win.on('closed', () => (mainWindow = null))

  // Nada de ventanas nuevas ni navegación fuera de la app.
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  win.webContents.on('will-navigate', (event) => event.preventDefault())
  installShortcuts(win)

  if (DEV_SERVER_URL) void win.loadURL(DEV_SERVER_URL)
  else void win.loadFile(join(__dirname, '..', 'dist', 'index.html'))
}

function installMenu(): void {
  if (!isMac) {
    Menu.setApplicationMenu(null)
    return
  }
  // macOS necesita un menú con roles de edición para que funcionen ⌘C / ⌘V / ⌘X.
  const template: MenuItemConstructorOptions[] = [{ role: 'appMenu' }, { role: 'editMenu' }, { role: 'windowMenu' }]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

/* ------------------------------------ Arranque ------------------------------------ */

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (!mainWindow) return
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.focus()
  })

  void app.whenReady().then(() => {
    try {
      vault = createVault(app.getPath('userData'))
    } catch (error) {
      dialog.showErrorBox('Prompt Vault no pudo abrir tu biblioteca', error instanceof Error ? error.message : String(error))
      app.quit()
      return
    }
    lockDownSession()
    registerIpc()
    installMenu()
    createWindow()

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })

  app.on('window-all-closed', () => {
    if (!isMac) app.quit()
  })

  app.on('will-quit', () => vault?.close())
}
