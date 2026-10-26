# Prompt Vault — Arquitectura

Biblioteca personal de prompts. Local primero (offline-first), preparada para evolucionar a web/nube sin rehacer el frontend.

## 1. Decisiones de stack (y por qué)

| Decisión | Elegido | Alternativas descartadas |
|---|---|---|
| Contenedor | **Electron** | Tauri (requiere Rust, no instalado). PWA pura (el navegador reserva `Ctrl+N`, `Ctrl+Shift+C`; el almacenamiento puede borrarse al limpiar datos). |
| UI | **React 19 + TypeScript + Vite** | — |
| Persistencia | **SQLite (`node:sqlite`, integrado en Node 24/Electron)** | IndexedDB (frágil, sin SQL), JSON plano (sin relaciones/versionado), `better-sqlite3` (módulo nativo, compilación en Windows). |
| Búsqueda | **Cliente**, normalizada (sin acentos), por tokens con pesos, sobre la biblioteca en memoria | FTS5 (disponible en el esquema futuro; innecesario a escala personal), búsqueda semántica (roadmap). |
| Estado | **Zustand** | Redux (excesivo), Context puro (re-renders). |
| Rutas | **React Router (hash)** | Router propio. Hash router funciona con `file://` (Electron) y en web estática. |
| Estilos | **CSS propio con tokens (variables CSS)** | Tailwind (menos control del acabado y de los dos temas). |
| Fuentes | Inter + Instrument Serif, **empaquetadas en local** | Google Fonts (peticiones externas: incumple privacidad). |

## 2. Capas

```
┌──────────────────────────── Renderer (src/) ────────────────────────────┐
│ React · Zustand · features/*   solo conoce  VaultApi  (shared/api.ts)    │
└───────────────┬─────────────────────────────────────────────────────────┘
                │  transporte (src/api/transport.ts)
      ┌─────────┴──────────┐
      │ IPC (Electron)     │  HTTP POST /rpc (modo web local / futura nube)
      └─────────┬──────────┘
┌───────────────┴─────────── Backend (backend/) ──────────────────────────┐
│ rpc.ts (dispatch whitelist) → VaultService (casos de uso, validación,   │
│ transacciones) → repos/* (SQL) → db.ts (node:sqlite, migraciones)       │
└─────────────────────────────────────────────────────────────────────────┘
        shared/  =  tipos, errores, variables, búsqueda, formatos de
                    import/export, validación  (TS puro, sin Node ni DOM)
```

* **Un solo contrato** (`VaultApi`). Para la nube: cliente HTTP remoto + servicio con Postgres + auth. La UI no cambia.
* **Errores tipados** (`VaultError` con `code`) viajan como envoltorio `{ok, value | error}` por cualquier transporte.
* **IDs UUID generados en cliente**, fechas ISO-8601 UTC y `updated_at` en todo → base para sincronización.
* **Preferencias de UI** (tema, vista, orden) en `localStorage`: son del dispositivo, no de la biblioteca.

## 3. Modelo de datos (SQLite, `PRAGMA user_version` = versión de esquema)

```sql
categories(id PK, name UNIQUE NOCASE, color, sort_order, created_at, updated_at)
projects  (id PK, name UNIQUE NOCASE, description, is_demo, created_at, updated_at)
tags      (id PK, name UNIQUE NOCASE, created_at)
tools     (id PK, name UNIQUE NOCASE, sort_order, created_at, updated_at)   -- 'general' protegido
prompts   (id PK, title, description, content, notes,
           category_id → categories ON DELETE SET NULL,
           project_id  → projects   ON DELETE SET NULL,
           tool_id     → tools      (NOT NULL, default 'general'),
           favorite, archived, is_demo, usage_count,
           created_at, updated_at, last_used_at)
prompt_tags(prompt_id → prompts CASCADE, tag_id → tags CASCADE, PK(prompt_id, tag_id))
prompt_versions(id PK, prompt_id → prompts CASCADE, version, name, content, notes,
                created_at, UNIQUE(prompt_id, version))
settings(key PK, value)      -- datos de la biblioteca: welcome_done, last_backup_at, seeded
```

Reglas: borrar categoría/proyecto deja los prompts sin ellos; borrar herramienta los pasa a *General*; las etiquetas huérfanas se limpian; los nombres son únicos sin distinguir mayúsculas ni acentos.

## 4. Variables

Sintaxis `{{nombre}}` (letras, números, `_`, `-`, `.`). Se detectan en orden y sin duplicados. Al copiar, si se rellenó algún valor se copia el texto completado; las variables vacías se dejan intactas.

## 5. Versionado

`Crear versión` guarda una instantánea (número correlativo, nombre opcional, notas, fecha) del contenido actual. Al editar se puede marcar *"guardar la versión anterior"*. Restaurar una versión guarda antes el estado actual como versión de seguridad si no coincide con ninguna.

## 6. Formato de intercambio (`prompt-vault` v1)

```json
{ "app": "prompt-vault", "formatVersion": 1, "exportedAt": "…",
  "categories": [], "projects": [], "tools": [], "tags": [],
  "prompts": [{ "id": "…", "title": "…", "tags": ["…"], "versions": [] }] }
```

* **Backup** = formato completo (`createBackup`); la fecha del «último backup» solo se anota (`recordBackup`) cuando el archivo se guardó de verdad. **Restaurar** = reemplazo atómico en una transacción tras validar el archivo (un backup corrupto no toca los datos actuales) y tras una copia automática previa; si algo falla a mitad, se deshace todo.
* **Importar** (JSON/CSV/Markdown/TXT/texto pegado) = fusión con vista previa y detección de duplicados.
* **Exportar** JSON / CSV / Markdown / TXT, todo o selección.

## 7. Seguridad y privacidad

* Todo en `%APPDATA%/Prompt Vault/` (Windows): `vault.db`, `backups/` (copias automáticas diarias, últimas 7, y previas a restauraciones).
* Sin telemetría, sin cuentas, sin servicios externos. La versión compilada incluye una CSP `default-src 'self'` (meta en el HTML) que bloquea cualquier conexión externa; en Electron además: sin navegación ni ventanas nuevas, `contextIsolation` + `sandbox`, permisos denegados e IPC que valida el origen del emisor. El portapapeles y el guardado de archivos van por IPC (sin permisos web).
* El modo web local escucha **solo en 127.0.0.1** y rechaza peticiones con `Origin` ajeno.

## 8. Estructura de carpetas

```
shared/      tipos, api (contrato VaultApi), bridge, errores, texto, variables, búsqueda,
             validación y formats/ (backup JSON, CSV, Markdown/TXT, importación)
backend/     db + migraciones, repos/, library-service (prompts, taxonomía, versiones),
             vault-service (datos: exportar, importar, restaurar, demo), rpc, auto-backup,
             seed (categorías y herramientas iniciales), demo-data, vault (composición)
electron/    main.ts (ventana, IPC, seguridad), preload.ts (puente aislado)
server/      app.ts (HTTP: /rpc + estáticos + protecciones), http-host.ts (arranque)
src/         app/ (rutas, shell, sidebar), api/ (cliente y plataforma), store/ (Zustand),
             components/ (primitivas de UI), features/ (home, library, prompt, editor,
             organize, settings, dialogs, palette, welcome, data), hooks/, styles/, utils/
tests/       vitest: lógica compartida, servicio sobre SQLite en memoria, lógica de UI, servidor HTTP
scripts/     dev.mjs, build-backend.mjs, make-icon.cjs
docs/
```

## 9. Decisiones que se tomaron al implementar

* **Búsqueda en cliente**: con 3 000 prompts (11 MB de texto) cada consulta tarda 4–7 ms y el índice se construye una vez en ~270 ms. FTS5 sigue disponible en SQLite para cuando haga falta.
* **Preferencias de interfaz** (tema, vista, orden, secciones plegadas) en `localStorage`: son del dispositivo, no de la biblioteca.
* **Datos de demostración**: `is_demo`; al editar un prompt de ejemplo deja de serlo, así que «eliminar ejemplos» nunca borra trabajo propio.
* **Copias automáticas** diarias (7) y previas a restaurar: red de seguridad local, además del backup JSON.
* **Una sola fuente de verdad para el contrato**: `API_METHODS` (lista blanca RPC) está verificada por el compilador contra `VaultApi`.
* **Popover API + `<dialog>` nativos** para menús, selectores y diálogos: foco, Esc y capas «gratis» y sin dependencias.

## 10. MVP vs Roadmap

**MVP (este repositorio):** CRUD de prompts, categorías, proyectos, etiquetas y herramientas; búsqueda en vivo; lista/cuadrícula; detalle con copiado; variables; favoritos; recientes y contador de uso; duplicar y archivar; versiones; importar/exportar/backup/restaurar; paleta de comandos y atajos; tema claro/oscuro/sistema; responsive; demo; bienvenida.

**Roadmap (no implementado, arquitectura preparada):**
1. Sincronización/nube: transporte HTTP remoto + Postgres + auth; `deleted_at` (tombstones) y `device_id` para resolver conflictos.
2. IA: *Mejorar prompt*, generar variaciones (corta, profesional, para Claude/ChatGPT).
3. Búsqueda semántica (embeddings locales) y FTS5 para bibliotecas grandes.
4. Analítica: más usados por periodo (requiere tabla `usage_events`).
5. Integraciones: enviar el prompt a la herramienta destino.
6. App móvil / web (el renderer ya es responsive y desacoplado de Electron).
7. Colaboración y bibliotecas compartidas.
