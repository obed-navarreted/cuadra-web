import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './auth/AuthProvider'
import { useAuth } from './auth/context'
import { Spinner } from './components/ui'
import { AppShell } from './layout/AppShell'
import { NAV } from './layout/nav'
import { ViewAsExitRedirect } from './layout/ViewAsBar'
import { LoginPage } from './pages/LoginPage'
import { NoAccessPage } from './pages/NoAccessPage'
import { PlanProvider } from './plan/PlanProvider'
import { SectionGuard } from './plan/SectionGuard'

// Cada sección se carga cuando se abre: el panel abre rápido aunque tenga muchas pantallas.
const pages = {
  resumen: lazy(() => import('./pages/resumen')),
  ventas: lazy(() => import('./pages/ventas')),
  fiados: lazy(() => import('./pages/fiados')),
  gastos: lazy(() => import('./pages/gastos')),
  inventario: lazy(() => import('./pages/inventario')),
  cierres: lazy(() => import('./pages/cierres')),
  reportes: lazy(() => import('./pages/reportes')),
  equipo: lazy(() => import('./pages/equipo')),
  avisos: lazy(() => import('./pages/avisos')),
  ajustes: lazy(() => import('./pages/ajustes')),
  plan: lazy(() => import('./pages/plan')),
  ayuda: lazy(() => import('./pages/ayuda')),
}

// La consola de la plataforma (solo admins de plataforma): tiene su propio marco y no necesita un negocio.
const Consola = lazy(() => import('./pages/consola'))

/** Solo entra quien tiene sesión y es dueño o admin de algún negocio. */
function RequirePanel() {
  const { status, me, memberships, canUsePanel } = useAuth()
  if (status === 'loading') return <Spinner />
  if (status === 'signedOut') return <Navigate to="/login" replace />
  if (memberships.length === 0 && me?.platformAdmin) return <Navigate to="/console" replace />
  if (memberships.length === 0) return <NoAccessPage reason="none" />
  if (!canUsePanel) return <NoAccessPage reason="role" />
  return <Outlet />
}

function Login() {
  const { status } = useAuth()
  if (status === 'loading') return <Spinner />
  return status === 'ready' ? <Navigate to="/resumen" replace /> : <LoginPage />
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter basename={import.meta.env.BASE_URL}>
        <ViewAsExitRedirect />
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/console/*"
            element={
              <Suspense fallback={<Spinner />}>
                <Consola />
              </Suspense>
            }
          />
          <Route element={<RequirePanel />}>
            <Route
              element={
                <PlanProvider>
                  <AppShell />
                </PlanProvider>
              }
            >
              <Route index element={<Navigate to="/resumen" replace />} />
              {NAV.map(({ key, path }) => {
                const Page = pages[key]
                return (
                  <Route
                    key={key}
                    path={`${path}/*`}
                    element={
                      <Suspense fallback={<Spinner />}>
                        <SectionGuard navKey={key}>
                          <Page />
                        </SectionGuard>
                      </Suspense>
                    }
                  />
                )
              })}
              <Route path="*" element={<Navigate to="/resumen" replace />} />
            </Route>
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
