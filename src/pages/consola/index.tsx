import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, NavLink, Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { useAuth } from '../../auth/context'
import { LanguageSwitcher } from '../../components/LanguageSwitcher'
import { SignOutAll } from '../../components/SignOutAll'
import { Button, Spinner } from '../../components/ui'
import { AnnouncementsPage } from './AnnouncementsPage'
import { AuditPage } from './AuditPage'
import { BusinessDetailPage } from './BusinessDetailPage'
import { BusinessesPage } from './BusinessesPage'
import { ConfigPage } from './ConfigPage'
import { DevicesPage } from './DevicesPage'
import { MetricsPage } from './MetricsPage'
import { TicketsPage } from './TicketsPage'
import { UsersPage } from './UsersPage'
import './consola.css'

const CONSOLE_NAV = [
  { key: 'metrics', path: '' },
  { key: 'businesses', path: 'negocios' },
  { key: 'users', path: 'usuarios' },
  { key: 'devices', path: 'telefonos' },
  { key: 'tickets', path: 'tickets' },
  { key: 'config', path: 'config' },
  { key: 'announcements', path: 'anuncios' },
  { key: 'audit', path: 'auditoria' },
] as const

/** Para quien no es admin de plataforma la consola no existe: se ve como cualquier ruta que no existe (igual que la API, que contesta 404). */
export function ConsoleNotFound() {
  const { t } = useTranslation('consola')
  return (
    <main className="center-page">
      <h1>{t('notFound.title')}</h1>
      <p className="muted">{t('notFound.body')}</p>
      <div className="row">
        <Link className="btn" to="/">
          {t('notFound.back')}
        </Link>
      </div>
    </main>
  )
}

function ConsoleShell() {
  const { t } = useTranslation('consola')
  const { me, memberships, signOut } = useAuth()
  const [open, setOpen] = useState(false)
  return (
    <div className={`app-shell${open ? ' menu-open' : ''}`}>
      <header className="topbar">
        <button type="button" className="icon-btn" aria-label={t('menu')} aria-expanded={open} onClick={() => setOpen((o) => !o)}>
          <span aria-hidden="true">☰</span>
        </button>
        <strong className="brand">{t('title')}</strong>
        <span className="grow" />
        <LanguageSwitcher />
      </header>
      <aside className="side" aria-label={t('menu')}>
        <div className="side-brand">{t('title')}</div>
        <nav>
          {CONSOLE_NAV.map((n) => (
            <NavLink key={n.key} to={`/console${n.path ? `/${n.path}` : ''}`} end={n.path === ''} onClick={() => setOpen(false)} className={({ isActive }) => (isActive ? 'on' : undefined)}>
              {t(`nav.${n.key}`)}
            </NavLink>
          ))}
        </nav>
        <div className="side-foot">
          <span className="muted small">{me?.email}</span>
          {memberships.length > 0 && (
            <Link className="btn small" to="/resumen">
              {t('backToPanel')}
            </Link>
          )}
          <Button small onClick={() => void signOut()}>
            {t('auth.signOut', { ns: 'common' })}
          </Button>
          <SignOutAll />
        </div>
      </aside>
      <main className="content consola">
        <Outlet />
      </main>
    </div>
  )
}

/** Consola de la plataforma (`/console/*`): solo para admins de plataforma. Sin sesión va a entrar; con sesión pero sin permiso, "no encontrado". */
export default function ConsolePage() {
  const { status, me } = useAuth()
  if (status === 'loading') return <Spinner />
  if (status === 'signedOut') return <Navigate to="/login" replace />
  if (!me?.platformAdmin || me.viewAsBusinessId) return <ConsoleNotFound />
  return (
    <Routes>
      <Route element={<ConsoleShell />}>
        <Route index element={<MetricsPage />} />
        <Route path="negocios" element={<BusinessesPage />} />
        <Route path="negocios/:id" element={<BusinessDetailPage />} />
        <Route path="usuarios" element={<UsersPage />} />
        <Route path="telefonos" element={<DevicesPage />} />
        <Route path="tickets" element={<TicketsPage />} />
        <Route path="config" element={<ConfigPage />} />
        <Route path="anuncios" element={<AnnouncementsPage />} />
        <Route path="auditoria" element={<AuditPage />} />
        <Route path="*" element={<Navigate to="/console" replace />} />
      </Route>
    </Routes>
  )
}
