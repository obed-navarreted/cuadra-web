import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { errorText } from '../lib/errors'

/** Encabezado de una pantalla: título, subtítulo y acciones a la derecha (en el celular pasan debajo). */
export function Page({ title, subtitle, actions, children }: { title: string; subtitle?: ReactNode; actions?: ReactNode; children: ReactNode }) {
  return (
    <section className="page">
      <header className="page-head">
        <div className="grow">
          <h1>{title}</h1>
          {subtitle && <p className="muted">{subtitle}</p>}
        </div>
        {actions && <div className="page-actions">{actions}</div>}
      </header>
      {children}
    </section>
  )
}

export function Card({ title, actions, children, tone }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; tone?: 'green' | 'orange' | 'red' }) {
  return (
    <div className={`card${tone ? ` tone-${tone}` : ''}`}>
      {(title || actions) && (
        <div className="card-head">
          {title && <h2 className="grow">{title}</h2>}
          {actions}
        </div>
      )}
      {children}
    </div>
  )
}

/** Cifra grande con su etiqueta; `tone` la resalta (verde = bueno, naranja = atención). */
export function Kpi({ label, value, hint, tone }: { label: string; value: ReactNode; hint?: ReactNode; tone?: 'green' | 'orange' | 'red' }) {
  return (
    <div className={`kpi${tone ? ` tone-${tone}` : ''}`}>
      <span className="kpi-label">{label}</span>
      <span className="kpi-value">{value}</span>
      {hint && <span className="kpi-hint">{hint}</span>}
    </div>
  )
}

export function Tag({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'green' | 'orange' | 'red' }) {
  return <span className={`tag tag-${tone}`}>{children}</span>
}

export function Spinner() {
  const { t } = useTranslation()
  return (
    <div className="spinner" role="status">
      {t('shell.loading')}
    </div>
  )
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <div className="empty">{children}</div>
}

/** Un error de la API en lenguaje simple, con "Reintentar" si se puede repetir. */
export function ErrorNotice({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const { t } = useTranslation()
  return (
    <div className="notice error" role="alert">
      <span className="grow">{errorText(t, error)}</span>
      {onRetry && (
        <button type="button" className="btn small" onClick={onRetry}>
          {t('shell.retry')}
        </button>
      )}
    </div>
  )
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { kind?: 'primary' | 'dark' | 'danger' | 'plain'; small?: boolean }

export function Button({ kind = 'plain', small, className, ...rest }: ButtonProps) {
  return <button type="button" {...rest} className={`btn ${kind === 'plain' ? '' : kind} ${small ? 'small' : ''} ${className ?? ''}`.replace(/\s+/g, ' ').trim()} />
}

/** Campo con etiqueta visible (nunca solo placeholder). */
export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  )
}

/** Pestañas simples (una sola pantalla con varias vistas). */
export function Tabs<K extends string>({ value, onChange, items }: { value: K; onChange: (k: K) => void; items: { key: K; label: string }[] }) {
  return (
    <div className="chips" role="tablist">
      {items.map((i) => (
        <button key={i.key} type="button" role="tab" aria-selected={value === i.key} className={`chip${value === i.key ? ' on' : ''}`} onClick={() => onChange(i.key)}>
          {i.label}
        </button>
      ))}
    </div>
  )
}
