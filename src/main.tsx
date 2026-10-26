import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/inter'
import '@fontsource/instrument-serif'
import './styles/tokens.css'
import './styles/base.css'
import './styles/components.css'
import './styles/shell.css'
import './styles/library.css'
import './styles/prompt.css'
import './styles/editor.css'
import './styles/pages.css'
import { App } from './app/App'
import { initTheme } from './store/ui'

initTheme()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
