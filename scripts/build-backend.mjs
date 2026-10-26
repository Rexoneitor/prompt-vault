// Compila el proceso principal de Electron, el preload y el anfitrión web con esbuild.
// `node:sqlite` y el resto de módulos `node:` quedan como externos automáticamente.
import { fileURLToPath, pathToFileURL } from 'node:url'
import { build } from 'esbuild'

const root = fileURLToPath(new URL('..', import.meta.url))

const common = {
  absWorkingDir: root,
  tsconfig: 'tsconfig.node.json', // aquí viven los alias @shared y @backend
  bundle: true,
  platform: 'node',
  target: 'node24',
  sourcemap: false,
  logLevel: 'info',
}

export async function buildBackend() {
  await Promise.all([
    build({ ...common, entryPoints: ['electron/main.ts'], outfile: 'dist-electron/main.cjs', format: 'cjs', external: ['electron'] }),
    build({ ...common, entryPoints: ['electron/preload.ts'], outfile: 'dist-electron/preload.cjs', format: 'cjs', external: ['electron'] }),
    build({ ...common, entryPoints: ['server/http-host.ts'], outfile: 'dist-server/http-host.mjs', format: 'esm' }),
  ])
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await buildBackend()
}
