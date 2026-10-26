// Genera los iconos de la aplicación a partir de public/favicon.svg, usando el propio Electron como rasterizador:
//   build/icon.png (512×512)  y  build/icon.ico (16–256 px, con imágenes PNG incrustadas)
//   npm run icon
const { app, BrowserWindow } = require('electron')
const { mkdirSync, readFileSync, writeFileSync } = require('node:fs')
const { join } = require('node:path')

const SIZE = 512
const ICO_SIZES = [16, 24, 32, 48, 64, 128, 256]

/** Contenedor ICO: cabecera + directorio + imágenes PNG (admitido desde Windows Vista). */
function buildIco(images) {
  const header = Buffer.alloc(6)
  header.writeUInt16LE(1, 2) // tipo: icono
  header.writeUInt16LE(images.length, 4)

  let offset = 6 + images.length * 16
  const entries = images.map(({ size, png }) => {
    const entry = Buffer.alloc(16)
    entry.writeUInt8(size === 256 ? 0 : size, 0)
    entry.writeUInt8(size === 256 ? 0 : size, 1)
    entry.writeUInt16LE(1, 4) // planos
    entry.writeUInt16LE(32, 6) // bits por píxel
    entry.writeUInt32LE(png.length, 8)
    entry.writeUInt32LE(offset, 12)
    offset += png.length
    return entry
  })
  return Buffer.concat([header, ...entries, ...images.map((image) => image.png)])
}

app.disableHardwareAcceleration()
app.whenReady().then(async () => {
  const svg = readFileSync(join(__dirname, '..', 'public', 'favicon.svg'), 'utf8')
  const page = `<style>html,body{margin:0;background:transparent;overflow:hidden}svg{display:block;width:${SIZE}px;height:${SIZE}px}</style>${svg}`

  const win = new BrowserWindow({
    width: SIZE,
    height: SIZE,
    show: false,
    transparent: true,
    frame: false,
    useContentSize: true,
    webPreferences: { offscreen: true },
  })
  await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(page)}`)
  await new Promise((resolve) => setTimeout(resolve, 300))

  const master = (await win.webContents.capturePage()).resize({ width: SIZE, height: SIZE, quality: 'best' })
  const out = join(__dirname, '..', 'build')
  mkdirSync(out, { recursive: true })
  writeFileSync(join(out, 'icon.png'), master.toPNG())
  writeFileSync(
    join(out, 'icon.ico'),
    buildIco(ICO_SIZES.map((size) => ({ size, png: master.resize({ width: size, height: size, quality: 'best' }).toPNG() }))),
  )
  console.log(`build/icon.png (${SIZE}×${SIZE}) y build/icon.ico (${ICO_SIZES.join(', ')} px) generados`)
  app.quit()
})
