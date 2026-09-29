import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './i18n'
import { guardFraming } from './lib/frameGuard'
import './styles/tokens.css'
import './styles/app.css'

if (!guardFraming()) {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}
