import { Fragment, useMemo, type ReactNode } from 'react'
import { splitCodeBlocks } from '@/utils/blocks'
import { splitVariables, type VariableValues } from '@shared/variables'

function renderWithVariables(text: string, values: VariableValues): ReactNode {
  return splitVariables(text).map((segment, index) => {
    if (segment.kind === 'text') return <Fragment key={index}>{segment.text}</Fragment>
    const value = values[segment.name]
    return value ? (
      <span key={index} className="var var-filled" title={`{{${segment.name}}}`}>
        {value}
      </span>
    ) : (
      <span key={index} className="var">
        {segment.raw}
      </span>
    )
  })
}

interface PromptBodyProps {
  content: string
  values?: VariableValues
}

const NO_VALUES: VariableValues = {}

/**
 * Muestra el prompt tal cual se copiará: texto con saltos de línea intactos, bloques de código
 * y variables {{así}} resaltadas (o sustituidas por el valor que se esté completando).
 */
export function PromptBody({ content, values = NO_VALUES }: PromptBodyProps) {
  const blocks = useMemo(() => splitCodeBlocks(content), [content])
  return (
    <div className="prompt-body">
      {blocks.map((block, index) =>
        block.kind === 'code' ? (
          <pre key={index} className="prompt-code">
            {block.lang && <span className="prompt-code-lang">{block.lang}</span>}
            <code>{renderWithVariables(block.text, values)}</code>
          </pre>
        ) : (
          <div key={index} className="prompt-text">
            {renderWithVariables(block.text.replace(/^\n+|\n+$/g, ''), values)}
          </div>
        ),
      )}
    </div>
  )
}
