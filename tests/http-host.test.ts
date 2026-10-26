import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { request } from 'node:http'
import type { AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createHttpApp } from '../server/app'
import { createTestService } from './helpers'

let baseUrl = ''
let close: () => Promise<void>

beforeAll(async () => {
  const staticDir = mkdtempSync(join(tmpdir(), 'pv-static-'))
  writeFileSync(join(staticDir, 'index.html'), '<!doctype html><title>Prompt Vault</title>')
  mkdirSync(join(staticDir, 'assets'))
  writeFileSync(join(staticDir, 'assets', 'app.js'), 'console.log(1)')

  const { service } = createTestService()
  const server = createHttpApp(service, staticDir)
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  close = () => new Promise((resolve) => server.close(() => resolve()))
})

afterAll(() => close())

/** `fetch` ignora la cabecera Host; con `http.request` se puede simular un ataque de DNS rebinding. */
const statusWithHost = (host: string) =>
  new Promise<number>((resolve, reject) => {
    const url = new URL(baseUrl)
    const req = request(
      { hostname: url.hostname, port: url.port, path: '/rpc', method: 'POST', headers: { Host: host, 'Content-Type': 'application/json' } },
      (res) => {
        res.resume()
        resolve(res.statusCode ?? 0)
      },
    )
    req.on('error', reject)
    req.end('{"method":"getLibrary","args":[]}')
  })

const rpc = (method: string, args: unknown[] = [], headers: Record<string, string> = {}) =>
  fetch(`${baseUrl}/rpc`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify({ method, args }),
  })

describe('servidor HTTP local', () => {
  it('atiende llamadas RPC y devuelve el envoltorio {ok, value}', async () => {
    const response = await rpc('getLibrary')
    const body = (await response.json()) as { ok: boolean; value: { categories: unknown[] } }
    expect(response.status).toBe(200)
    expect(body.ok).toBe(true)
    expect(body.value.categories).toHaveLength(15)
  })

  it('propaga errores de dominio con su código', async () => {
    const response = await rpc('createPrompt', [{ title: '', content: '   ', tags: [], toolId: 'general' }])
    const body = (await response.json()) as { ok: boolean; error: { code: string } }
    expect(body.ok).toBe(false)
    expect(body.error.code).toBe('VALIDATION')
  })

  it('solo permite los métodos de la lista blanca', async () => {
    for (const method of ['constructor', '__proto__', 'toString', 'db']) {
      const body = (await (await rpc(method)).json()) as { ok: boolean; error: { message: string } }
      expect(body.ok).toBe(false)
      expect(body.error.message).toMatch(/desconocido/)
    }
  })

  it('rechaza orígenes y hosts que no son locales (CSRF / DNS rebinding)', async () => {
    expect((await rpc('getLibrary', [], { Origin: 'https://sitio-malicioso.example' })).status).toBe(403)
    expect(await statusWithHost('evil.example')).toBe(403)
    expect(await statusWithHost('127.0.0.1:4871')).toBe(200)
    expect((await rpc('getLibrary', [], { Origin: 'http://localhost:5173' })).status).toBe(200)
  })

  it('exige JSON y POST en /rpc', async () => {
    expect((await fetch(`${baseUrl}/rpc`, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: '{}' })).status).toBe(405)
    expect((await fetch(`${baseUrl}/rpc`)).status).toBe(405)
  })

  it('responde 400 ante un cuerpo que no es JSON', async () => {
    const response = await fetch(`${baseUrl}/rpc`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{ roto' })
    expect(response.status).toBe(400)
  })

  it('sirve la interfaz con CSP y no permite salir del directorio estático', async () => {
    const index = await fetch(baseUrl)
    expect(index.status).toBe(200)
    expect(index.headers.get('content-security-policy')).toContain("default-src 'self'")
    expect(await index.text()).toContain('Prompt Vault')

    const asset = await fetch(`${baseUrl}/assets/app.js`)
    expect(asset.headers.get('content-type')).toContain('javascript')

    // Un recorrido de directorios acaba en la portada, nunca en un archivo del sistema.
    const traversal = await fetch(`${baseUrl}/..%2f..%2f..%2fwindows%2fwin.ini`)
    expect(await traversal.text()).toContain('Prompt Vault')
  })
})
