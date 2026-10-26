import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vitest/config'

const fromRoot = (path: string) => fileURLToPath(new URL(path, import.meta.url))
const { version } = JSON.parse(readFileSync(fromRoot('./package.json'), 'utf8')) as { version: string }

/**
 * Política de seguridad de contenido de la versión compilada: la interfaz solo puede cargar
 * recursos propios, así que no puede contactar con ningún servidor externo.
 * (En desarrollo se omite porque Vite inyecta scripts y un websocket.)
 */
const CSP =
  "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'"

const contentSecurityPolicy = (): Plugin => ({
  name: 'prompt-vault:csp',
  apply: 'build',
  transformIndexHtml: (html) => html.replace('<head>', `<head>\n    <meta http-equiv="Content-Security-Policy" content="${CSP}" />`),
})

export default defineConfig({
  base: './',
  plugins: [react(), contentSecurityPolicy()],
  define: { __APP_VERSION__: JSON.stringify(version) },
  resolve: {
    alias: {
      '@shared': fromRoot('./shared'),
      '@backend': fromRoot('./backend'),
      '@': fromRoot('./src'),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    // En modo web local el backend corre aparte; el cliente llama a /rpc.
    proxy: { '/rpc': 'http://127.0.0.1:4871' },
  },
  build: { outDir: 'dist', emptyOutDir: true, sourcemap: false },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
})
