// Entorno de desarrollo.
//   npm run dev      → servidor Vite + ventana de Electron (datos reales de la app)
//   npm run dev:web  → servidor Vite + backend HTTP local (abre http://localhost:5173 en un navegador)
// Con PV_DATA_DIR=<carpeta> se usan datos aislados.
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'
import { buildBackend } from './build-backend.mjs'

const root = fileURLToPath(new URL('..', import.meta.url))
const web = process.argv.includes('--web')

await buildBackend()

const vite = await createServer({ root, configFile: fileURLToPath(new URL('../vite.config.ts', import.meta.url)) })
await vite.listen()
const url = vite.resolvedUrls?.local[0]?.replace(/\/$/, '') ?? 'http://localhost:5173'

let child
if (web) {
  child = spawn(process.execPath, ['dist-server/http-host.mjs'], { cwd: root, stdio: 'inherit' })
  console.log(`\nInterfaz: ${url}`)
} else {
  const electronPath = createRequire(import.meta.url)('electron')
  child = spawn(electronPath, ['.'], {
    cwd: root,
    stdio: 'inherit',
    env: { ...process.env, VITE_DEV_SERVER_URL: url },
  })
}

const shutdown = async () => {
  child.kill()
  await vite.close()
  process.exit(0)
}
child.on('exit', shutdown)
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
