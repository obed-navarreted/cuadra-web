import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { NavLink, Outlet } from 'react-router-dom'
import { TenantScope } from '../components/TenantScope'
import { useAuth } from '../auth/context'
import { LanguageSwitcher } from '../components/LanguageSwitcher'
import { SignOutAll } from '../components/SignOutAll'
import { Button, Spinner } from '../components/ui'
import { SuspendedNotice } from '../plan/SuspendedNotice'
import { DeleteAccountDialog } from '../pages/cuenta/DeleteAccountDialog'
import { NAV } from './nav'
import { ViewAsBar } from './ViewAsBar'

/**
 * Marco del panel: menú lateral en pantallas anchas y cajón en el celular (360 px). El negocio activo se elige arriba; las pantallas solo se montan
 * cuando ya se conoce el negocio (así todas pueden usar `useBusiness()` sin comprobar nada).
 */
export function AppShell() {
  const { t } = useTranslation()
  const { me, memberships, membership, business, error, selectBusiness, signOut } = useAuth()
  const [open, setOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  // La consola es solo para admins de plataforma y nunca dentro de "Ver como".
  const showConsole = me?.platformAdmin === true && !me.viewAsBusinessId

  return (
    <>
    <ViewAsBar />
    <div className={`app-shell${open ? ' menu-open' : ''}`}>
      <header className="topbar">
        <button type="button" className="icon-btn" aria-label={t('shell.menu')} aria-expanded={open} onClick={() => setOpen((o) => !o)}>
          <span aria-hidden="true">☰</span>
        </button>
        <strong className="brand">{t('app.name')}</strong>
        <span className="grow" />
        <LanguageSwitcher />
      </header>
      <aside className="side" aria-label={t('shell.menu')}>
        <div className="side-brand">{t('app.name')}</div>
        <nav>
          {NAV.map((n) => (
            <NavLink key={n.key} to={n.path} onClick={() => setOpen(false)} className={({ isActive }) => (isActive ? 'on' : undefined)}>
              {t(`nav.${n.key}`)}
            </NavLink>
          ))}
          {showConsole && (
            <NavLink to="/console" onClick={() => setOpen(false)}>
              {t('nav.consola', { ns: 'consola' })}
            </NavLink>
          )}
        </nav>
        <div className="side-foot">
          <span className="muted small">{t('shell.business')}</span>
          {memberships.length > 1 ? (
            <select aria-label={t('shell.business')} value={membership?.businessId ?? ''} onChange={(e) => selectBusiness(e.target.value)}>
              {memberships.map((m) => (
                <option key={m.businessId} value={m.businessId ?? ''}>
                  {m.businessName}
                </option>
              ))}
            </select>
          ) : (
            <strong>{membership?.businessName}</strong>
          )}
          <span className="muted small">{me?.email}</span>
          {!me?.viewAsBusinessId && (
            <>
              <Button small onClick={() => void signOut()}>
                {t('auth.signOut')}
              </Button>
              <SignOutAll />
              <button type="button" className="link-danger" onClick={() => setDeleting(true)}>
                {t('account.delete')}
              </button>
            </>
          )}
        </div>
      </aside>
      <main className="content">
        <TenantScope id={`${me?.id ?? ''}:${business?.id ?? ''}`}>{business ? <Outlet /> : error === 'BUSINESS_SUSPENDED' ? <SuspendedNotice /> : <Spinner />}</TenantScope>
      </main>
    </div>
    <DeleteAccountDialog open={deleting} onClose={() => setDeleting(false)} />
    </>
  )
}
