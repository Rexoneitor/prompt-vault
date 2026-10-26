/** Arranque del modo web local: `npm run web` (tras `npm run build`). Escucha solo en 127.0.0.1. */
import { homedir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createVault } from '@backend/vault'
import { createHttpApp } from './app'

const PORT = Number(process.env.PV_PORT ?? 4871)
const DATA_DIR = process.env.PV_DATA_DIR ?? join(process.env.APPDATA ?? join(homedir(), '.local', 'share'), 'Prompt Vault Web')
const STATIC_DIR = fileURLToPath(new URL('../dist', import.meta.url))

const vault = createVault(DATA_DIR)
const server = createHttpApp(vault.api, STATIC_DIR)

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Prompt Vault (web local) → http://127.0.0.1:${PORT}`)
  console.log(`Datos: ${DATA_DIR}`)
})

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    server.close()
    vault.close()
    process.exit(0)
  })
}
