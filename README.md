# Prompt Vault

Tu biblioteca personal de prompts: **entrar → buscar → encontrar → copiar → usar**.
Aplicación de escritorio, local y privada. Sin cuentas, sin nube y sin telemetría.

![Electron](https://img.shields.io/badge/Electron-44-47848f) ![React](https://img.shields.io/badge/React-19-61dafb) ![SQLite](https://img.shields.io/badge/SQLite-node%3Asqlite-003b57)

## Empezar

**La forma más simple:** doble clic en **`Abrir Prompt Vault.cmd`** (o directamente en `release/Prompt-Vault-1.0.0.exe`).
No abras `index.html`: es solo código fuente y no funciona por sí solo.

Requisitos: **Node.js 24** o superior.

```bash
npm install          # instala dependencias
npm run dev          # modo desarrollo: ventana de Electron con recarga en caliente
```

Para usarla como aplicación normal:

```bash
npm run build        # compila interfaz y procesos
npm start            # abre la aplicación de escritorio
```

Para generar un ejecutable portable de Windows (`.exe` único, sin instalación):

```bash
npm run dist         # → release/Prompt-Vault-1.0.0.exe
```

> Si Windows muestra `EPERM ... rename` al empaquetar, suele ser el antivirus bloqueando temporalmente los archivos recién creados. Puedes especificar otra carpeta de salida:
> `npx electron-builder --config.directories.output=C:\\temp\\pv-release`.

### Modo web local (opcional)

La misma interfaz funciona en un navegador, hablando con el mismo backend por HTTP (solo en `127.0.0.1`):

```bash
npm run build && npm run web      # → http://127.0.0.1:4871
npm run dev:web                   # desarrollo con recarga en caliente
```

Úsalo para probar o para ver la interfaz en un navegador. La aplicación de escritorio es la experiencia
recomendada (los atajos `Ctrl+N` y `Ctrl+Shift+C` los reservan los navegadores).

## Dónde se guardan tus datos

| Qué | Dónde (Windows) |
|---|---|
| Biblioteca (SQLite) | `%APPDATA%\Prompt Vault\vault.db` |
| Copias automáticas | `%APPDATA%\Prompt Vault\backups\` (una al día, las últimas 7; y una antes de cada restauración) |
| Modo web local | `%APPDATA%\Prompt Vault Web\` |

Para volver a una copia automática: cierra la aplicación y copia ese archivo `.db` sobre `vault.db`.

*Ajustes → Tus datos* muestra la ruta exacta y permite abrir la carpeta. Para mover tu biblioteca a otro
equipo usa **Ajustes → Crear backup** (un único `.json`) y **Restaurar** en el otro.

## Qué puedes hacer

- **Buscar al instante** en título, descripción, contenido, categoría, etiquetas, proyecto y herramienta
  (sin distinguir acentos ni mayúsculas, con resaltado). Rápido con miles de prompts.
- **Copiar con un clic** (botón grande, o `Ctrl+Shift+C`). Cada copia suma al contador de uso y a «Recientes».
- **Variables**: escribe `{{audiencia}}` en un prompt y, al abrirlo, complétalas para copiar el texto ya relleno.
- **Organizar** con categorías (de colores, reordenables), proyectos, etiquetas y herramientas ampliables.
- **Versiones**: guarda instantáneas, compáralas con el contenido actual y restaura sin perder nada.
- **Favoritos, recientes, archivados**, duplicar, selección múltiple (exportar / archivar / eliminar).
- **Importar** JSON, CSV, Markdown, TXT o texto pegado (con vista previa y detección de duplicados).
- **Exportar** todo o una selección en JSON, CSV, Markdown o texto. **Backup** y **restaurar** en un clic.
- **Paleta de comandos** (`Ctrl/⌘+K`), tema claro / oscuro / sistema y diseño responsive.

### Atajos

| Atajo | Acción |
|---|---|
| `Ctrl/⌘ + K` | Buscar y paleta de comandos (`Ctrl+↵` copia el prompt seleccionado) |
| `Ctrl/⌘ + N` | Nuevo prompt |
| `Ctrl/⌘ + S` | Guardar (en el editor) |
| `Ctrl/⌘ + Shift + C` | Copiar el prompt abierto |
| `/` | Ir al buscador de la biblioteca |
| `Esc` | Cerrar diálogo o paleta |
| `Ctrl/⌘ + + / − / 0` | Zoom |

## Arquitectura en un vistazo

```
Interfaz (React)  →  VaultApi (contrato tipado)  →  IPC (Electron)  |  HTTP /rpc  →  VaultService  →  SQLite
```

La interfaz solo conoce el contrato `VaultApi` (`shared/api.ts`). Hoy lo implementa un servicio con SQLite
local; para llevarla a la nube bastaría cambiar el transporte por HTTP remoto y SQLite por otra base de datos,
sin tocar la interfaz. Detalles, modelo de datos y roadmap en [`docs/ARQUITECTURA.md`](docs/ARQUITECTURA.md).

```
shared/    lógica pura (tipos, búsqueda, variables, formatos de import/export, validación)
backend/   SQLite, migraciones, repositorios y servicios · electron/ proceso principal y preload
server/    anfitrión HTTP del modo web · src/ interfaz React · tests/ pruebas
```

## Desarrollo

| Comando | Qué hace |
|---|---|
| `npm run dev` | Electron + Vite con recarga en caliente |
| `npm test` | Pruebas (lógica, servicio sobre SQLite en memoria, servidor HTTP) |
| `npm run typecheck` | Comprueba tipos de la interfaz y del backend |
| `npm run build` | Compila interfaz y procesos |
| `npm run pack` / `dist` | Empaqueta (carpeta / portable) |
| `npm run icon` | Regenera `build/icon.*` desde `public/favicon.svg` |

Variables útiles: `PV_DATA_DIR=<carpeta>` usa datos aislados (pruebas); `PV_PORT` cambia el puerto del modo web.

## Privacidad y seguridad

- Todo ocurre en tu equipo. La versión compilada incluye una política CSP que impide cualquier conexión externa.
- Electron con `contextIsolation`, `sandbox`, sin permisos del navegador y sin navegación externa.
- El modo web local escucha solo en `127.0.0.1` y rechaza peticiones de otros orígenes.
- Los backups restaurados se validan por completo antes de tocar nada, y se aplican en una única transacción.
