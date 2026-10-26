/**
 * Migraciones de esquema, en orden. La posición (1-based) es la versión guardada en `PRAGMA user_version`.
 * Nunca se edita una migración ya publicada: se añade una nueva al final.
 */
export const MIGRATIONS: readonly string[] = [
  /* v1 — esquema inicial */
  `
  CREATE TABLE categories (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL UNIQUE COLLATE NOCASE,
    color       TEXT NOT NULL DEFAULT 'slate',
    sort_order  INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL
  );

  CREATE TABLE projects (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL UNIQUE COLLATE NOCASE,
    description TEXT NOT NULL DEFAULT '',
    is_demo     INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL
  );

  CREATE TABLE tags (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL UNIQUE COLLATE NOCASE,
    created_at  TEXT NOT NULL
  );

  CREATE TABLE tools (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL UNIQUE COLLATE NOCASE,
    sort_order  INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL
  );

  CREATE TABLE prompts (
    id           TEXT PRIMARY KEY,
    title        TEXT NOT NULL,
    description  TEXT NOT NULL DEFAULT '',
    content      TEXT NOT NULL,
    notes        TEXT NOT NULL DEFAULT '',
    category_id  TEXT REFERENCES categories(id) ON DELETE SET NULL,
    project_id   TEXT REFERENCES projects(id)   ON DELETE SET NULL,
    tool_id      TEXT NOT NULL DEFAULT 'general' REFERENCES tools(id),
    favorite     INTEGER NOT NULL DEFAULT 0,
    archived     INTEGER NOT NULL DEFAULT 0,
    is_demo      INTEGER NOT NULL DEFAULT 0,
    usage_count  INTEGER NOT NULL DEFAULT 0,
    created_at   TEXT NOT NULL,
    updated_at   TEXT NOT NULL,
    last_used_at TEXT
  );
  CREATE INDEX idx_prompts_updated   ON prompts(updated_at);
  CREATE INDEX idx_prompts_last_used ON prompts(last_used_at);
  CREATE INDEX idx_prompts_category  ON prompts(category_id);
  CREATE INDEX idx_prompts_project   ON prompts(project_id);
  CREATE INDEX idx_prompts_tool      ON prompts(tool_id);

  CREATE TABLE prompt_tags (
    prompt_id TEXT NOT NULL REFERENCES prompts(id) ON DELETE CASCADE,
    tag_id    TEXT NOT NULL REFERENCES tags(id)    ON DELETE CASCADE,
    PRIMARY KEY (prompt_id, tag_id)
  );
  CREATE INDEX idx_prompt_tags_tag ON prompt_tags(tag_id);

  CREATE TABLE prompt_versions (
    id         TEXT PRIMARY KEY,
    prompt_id  TEXT NOT NULL REFERENCES prompts(id) ON DELETE CASCADE,
    version    INTEGER NOT NULL,
    name       TEXT,
    content    TEXT NOT NULL,
    notes      TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    UNIQUE (prompt_id, version)
  );

  CREATE TABLE settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
  `,
]

export const SCHEMA_VERSION = MIGRATIONS.length
