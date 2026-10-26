/**
 * Servidor HTTP del modo web local: sirve la interfaz y expone la API por `POST /rpc`.
 * Es también el patrón del futuro backend en la nube (cambiando SQLite por otra base de datos
 * y añadiendo autenticación). Aquí solo hay lógica de red; el arranque está en `http-host.ts`.
 */
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { extname, join, normalize, resolve, sep } from 'node:path'
import type { VaultApi } from '@shared/api'
import { dispatchRpc } from '@backend/rpc'

export const MAX_BODY_BYTES = 128 * 1024 * 1024

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
}

const CSP =
  "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'"

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]'])

function hostnameOf(value: string | undefined): string | null {
  if (!value) return null
  try {
    return new URL(value.includes('://') ? value : `http://${value}`).hostname.toLowerCase()
  } catch {
    return null
  }
}

/** Evita que una página web cualquiera lance peticiones contra la biblioteca local (CSRF / DNS rebinding). */
export function isLocalRequest(request: IncomingMessage): boolean {
  const host = hostnameOf(request.headers.host)
  if (!host || !LOCAL_HOSTS.has(host)) return false
  const origin = request.headers.origin
  return origin === undefined || LOCAL_HOSTS.has(hostnameOf(origin) ?? '')
}

function send(response: ServerResponse, status: number, body: string | Buffer, headers: Record<string, string> = {}): void {
  response.writeHead(status, { 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-store', ...headers })
  response.end(body)
}

function readBody(request: IncomingMessage): Promise<string> {
  return new Promise((resolveBody, reject) => {
    const chunks: Buffer[] = []
    let size = 0
    request.on('data', (chunk: Buffer) => {
      size += chunk.length
      if (size > MAX_BODY_BYTES) {
        reject(new Error('Petición demasiado grande.'))
        request.destroy()
        return
      }
      chunks.push(chunk)
    })
    request.on('end', () => resolveBody(Buffer.concat(chunks).toString('utf8')))
    request.on('error', reject)
  })
}

function serveStatic(staticDir: string, pathname: string, response: ServerResponse): void {
  const root = resolve(staticDir)
  const requested = normalize(decodeURIComponent(pathname)).replace(/^([/\\])+/, '')
  let file = resolve(root, requested)
  if (file !== root && !file.startsWith(root + sep)) return send(response, 403, 'Prohibido')
  if (!existsSync(file) || statSync(file).isDirectory()) file = join(root, 'index.html')
  if (!existsSync(file)) return send(response, 404, 'Interfaz no compilada: ejecuta «npm run build».')
  const type = MIME[extname(file)] ?? 'application/octet-stream'
  send(response, 200, readFileSync(file), { 'Content-Type': type, 'Content-Security-Policy': CSP })
}

export function createHttpApp(api: VaultApi, staticDir: string): Server {
  return createServer(async (request, response) => {
    try {
      if (!isLocalRequest(request)) return send(response, 403, 'Origen no autorizado.')
      const url = new URL(request.url ?? '/', 'http://localhost')

      if (url.pathname === '/rpc') {
        // Exigir JSON obliga a una petición «con preflight» desde otros orígenes, que nunca autorizamos.
        if (request.method !== 'POST' || !(request.headers['content-type'] ?? '').startsWith('application/json')) {
          return send(response, 405, 'Método no permitido.')
        }
        const { method, args } = JSON.parse(await readBody(request)) as { method?: unknown; args?: unknown }
        const result = await dispatchRpc(api, method, args)
        return send(response, 200, JSON.stringify(result), { 'Content-Type': 'application/json; charset=utf-8' })
      }

      if (request.method !== 'GET' && request.method !== 'HEAD') return send(response, 405, 'Método no permitido.')
      serveStatic(staticDir, url.pathname, response)
    } catch (error) {
      console.error('[prompt-vault]', error)
      send(response, 400, 'Petición inválida.')
    }
  })
}
