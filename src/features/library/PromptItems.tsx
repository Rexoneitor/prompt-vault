import { useMemo, useState, type MouseEvent } from 'react'
import { Link } from 'react-router-dom'
import { Braces, Check, Copy, Star } from 'lucide-react'
import { ColorDot } from '@/components/ColorDot'
import { Highlight } from '@/components/Highlight'
import { IconButton } from '@/components/Button'
import { useCopyPrompt } from '@/hooks/useCopyPrompt'
import { useLookups } from '@/hooks/useLookups'
import { useLibrary } from '@/store/library'
import { attempt } from '@/store/ui'
import { makeSnippet } from '@shared/search'
import { nameKey } from '@shared/text'
import type { Prompt } from '@shared/types'
import { extractVariables } from '@shared/variables'
import { relativeTime } from '@/utils/date'

export interface ItemProps {
  prompt: Prompt
  /** Tokens de la búsqueda activa, para resaltar coincidencias. */
  tokens?: readonly string[]
  selecting?: boolean
  selected?: boolean
  onToggleSelect?: (id: string) => void
}

const MAX_CARD_TAGS = 3

/** Estrella de favorito. */
export function FavoriteButton({ prompt }: { prompt: Prompt }) {
  const onClick = (event: MouseEvent) => {
    event.preventDefault()
    event.stopPropagation()
    void attempt(() => useLibrary.getState().setFavorite(prompt.id, !prompt.favorite))
  }
  return (
    <IconButton
      label={prompt.favorite ? 'Quitar de favoritos' : 'Marcar como favorito'}
      size="sm"
      active={prompt.favorite}
      className={`fav-btn${prompt.favorite ? ' is-fav' : ''}`}
      onClick={onClick}
    >
      <Star size={16} fill={prompt.favorite ? 'currentColor' : 'none'} />
    </IconButton>
  )
}

/** Copia rápida con confirmación visual breve (✓). */
export function QuickCopyButton({ prompt }: { prompt: Prompt }) {
  const copyPrompt = useCopyPrompt()
  const [copied, setCopied] = useState(false)
  const onClick = async (event: MouseEvent) => {
    event.preventDefault()
    event.stopPropagation()
    if (await copyPrompt(prompt, { silent: true })) {
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    }
  }
  return (
    <IconButton
      label={copied ? 'Copiado' : 'Copiar prompt'}
      size="sm"
      className={`quick-copy${copied ? ' is-copied' : ''}`}
      onClick={onClick}
    >
      {copied ? <Check size={16} /> : <Copy size={16} />}
    </IconButton>
  )
}

function usePromptView(prompt: Prompt, tokens: readonly string[]) {
  const lookups = useLookups()
  return useMemo(() => {
    const category = prompt.categoryId ? lookups.categories.get(prompt.categoryId) : undefined
    const tool = lookups.tools.get(prompt.toolId)
    const tags = prompt.tagIds.map((id) => lookups.tags.get(id)?.name).filter((name): name is string => Boolean(name))
    const variables = extractVariables(prompt.content).length
    // Si la búsqueda coincide solo en el contenido, se enseña el fragmento para explicar el resultado.
    const visible = nameKey(`${prompt.title} ${prompt.description}`)
    const snippet = tokens.length > 0 && !tokens.every((t) => visible.includes(t)) ? makeSnippet(prompt.content, tokens) : null
    return { category, tool, tags, variables, snippet }
  }, [prompt, lookups, tokens])
}

const NO_TOKENS: readonly string[] = []

export function PromptCard({ prompt, tokens = NO_TOKENS, selecting, selected, onToggleSelect }: ItemProps) {
  const { category, tool, tags, variables, snippet } = usePromptView(prompt, tokens)
  const onSelectClick = selecting ? (event: MouseEvent) => (event.preventDefault(), onToggleSelect?.(prompt.id)) : undefined

  return (
    <article className={`card${selected ? ' is-selected' : ''}${prompt.archived ? ' is-archived' : ''}`}>
      <Link to={`/prompt/${prompt.id}`} className="card-link" onClick={onSelectClick} aria-label={prompt.title} />
      <div className="card-top">
        {selecting ? (
          <input
            type="checkbox"
            className="checkbox card-check"
            checked={selected}
            onChange={() => onToggleSelect?.(prompt.id)}
            aria-label={`Seleccionar ${prompt.title}`}
          />
        ) : (
          <span className="card-category">
            {category ? (
              <>
                <ColorDot color={category.color} />
                <span className="truncate">{category.name}</span>
              </>
            ) : (
              <span className="faint">Sin categoría</span>
            )}
          </span>
        )}
        <span className="card-top-actions">
          {prompt.isDemo && <span className="demo-badge">Demo</span>}
          {!selecting && <FavoriteButton prompt={prompt} />}
        </span>
      </div>

      <h3 className="card-title">
        <Highlight text={prompt.title} tokens={tokens} />
      </h3>
      <p className="card-description">
        {snippet ? (
          <Highlight text={snippet.text} tokens={tokens} />
        ) : prompt.description ? (
          <Highlight text={prompt.description} tokens={tokens} />
        ) : (
          <span className="faint">{prompt.content.replace(/\s+/g, ' ').slice(0, 140)}</span>
        )}
      </p>

      {tags.length > 0 && (
        <div className="card-tags">
          {tags.slice(0, MAX_CARD_TAGS).map((tag) => (
            <span key={tag} className="chip">
              {tag}
            </span>
          ))}
          {tags.length > MAX_CARD_TAGS && <span className="chip">+{tags.length - MAX_CARD_TAGS}</span>}
        </div>
      )}

      <footer className="card-footer">
        <span className="tool-badge">{tool?.name ?? 'General'}</span>
        {variables > 0 && (
          <span className="card-vars" data-tip={`${variables} variable${variables === 1 ? '' : 's'}`}>
            <Braces size={13} aria-hidden /> {variables}
          </span>
        )}
        <span className="card-time truncate">{relativeTime(prompt.updatedAt)}</span>
        {!selecting && <QuickCopyButton prompt={prompt} />}
      </footer>
    </article>
  )
}

export function PromptRow({ prompt, tokens = NO_TOKENS, selecting, selected, onToggleSelect }: ItemProps) {
  const { category, tool, tags, variables, snippet } = usePromptView(prompt, tokens)
  const onSelectClick = selecting ? (event: MouseEvent) => (event.preventDefault(), onToggleSelect?.(prompt.id)) : undefined

  return (
    <div className={`row${selected ? ' is-selected' : ''}${prompt.archived ? ' is-archived' : ''}`}>
      <Link to={`/prompt/${prompt.id}`} className="row-link" onClick={onSelectClick} aria-label={prompt.title} />
      <span className="row-lead">
        {selecting ? (
          <input
            type="checkbox"
            className="checkbox"
            checked={selected}
            onChange={() => onToggleSelect?.(prompt.id)}
            aria-label={`Seleccionar ${prompt.title}`}
          />
        ) : (
          <FavoriteButton prompt={prompt} />
        )}
      </span>
      <span className="row-main">
        <span className="row-title truncate">
          <Highlight text={prompt.title} tokens={tokens} />
          {prompt.isDemo && <span className="demo-badge">Demo</span>}
        </span>
        <span className="row-description truncate">
          {snippet ? (
            <Highlight text={snippet.text} tokens={tokens} />
          ) : prompt.description ? (
            <Highlight text={prompt.description} tokens={tokens} />
          ) : (
            prompt.content.replace(/\s+/g, ' ').slice(0, 140)
          )}
        </span>
      </span>
      <span className="row-category">
        {category && (
          <>
            <ColorDot color={category.color} />
            <span className="truncate">{category.name}</span>
          </>
        )}
      </span>
      <span className="row-tool">
        <span className="tool-badge">{tool?.name ?? 'General'}</span>
      </span>
      <span className="row-tags">
        {tags.slice(0, 2).map((tag) => (
          <span key={tag} className="chip">
            {tag}
          </span>
        ))}
        {tags.length > 2 && <span className="chip">+{tags.length - 2}</span>}
      </span>
      <span className="row-vars">
        {variables > 0 && (
          <span className="card-vars" data-tip={`${variables} variable${variables === 1 ? '' : 's'}`}>
            <Braces size={13} aria-hidden /> {variables}
          </span>
        )}
      </span>
      <span className="row-time">{relativeTime(prompt.updatedAt)}</span>
      <span className="row-actions">{!selecting && <QuickCopyButton prompt={prompt} />}</span>
    </div>
  )
}
