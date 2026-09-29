import { act, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import { Ctx } from '../../auth/context'
import { setLocale } from '../../i18n'
import { PlanCtx, type PlanValue } from '../../plan/context'
import { ProGate } from '../../plan/ProGate'
import { SectionGuard } from '../../plan/SectionGuard'
import type { PlanView } from '../../plan/logic'
import { authValue } from '../../test/renderPanel'
import { compareRows, usageRows } from './logic'
import PlanPage from './index'

const limits = { members: 3, devices: 2, schedules: 3, reportHistoryDays: 30, export: false, multipleBusinesses: false, webSections: ['resumen', 'fiados', 'ajustes', 'ayuda'] }
const free: PlanView = { plan: 'FREE', status: 'MANUAL', trialing: false, trialDaysLeft: 0, limits, usage: { members: 1, devices: 2, schedules: 0 } }
const trial: PlanView = {
  plan: 'PRO', status: 'TRIALING', trialing: true, trialDaysLeft: 12, trialEndsAt: '2026-10-11T12:00:00Z',
  limits: { members: 100, devices: 10, schedules: 50, reportHistoryDays: -1, export: true, multipleBusinesses: true, webSections: ['resumen', 'ventas'] },
  usage: { members: 2, devices: 1, schedules: 4 },
}

function view(ui: React.ReactElement, plan: Partial<PlanValue>) {
  const value: PlanValue = { plan: undefined, loading: false, failed: false, suspended: false, reload: () => undefined, ...plan }
  return render(
    <Ctx.Provider value={authValue()}>
      <PlanCtx.Provider value={value}>
        <MemoryRouter>{ui}</MemoryRouter>
      </PlanCtx.Provider>
    </Ctx.Provider>,
  )
}

beforeEach(async () => {
  await act(async () => {
    await setLocale('es')
  })
})

describe('lógica de la pantalla', () => {
  it('con plan Gratis los topes de Gratis salen del servidor; con Pro son los conocidos', () => {
    expect(compareRows({ ...free, limits: { ...limits, members: 5 } }).find((r) => r.key === 'members')).toMatchObject({ free: 5, pro: 100 })
    expect(compareRows(trial).find((r) => r.key === 'devices')).toMatchObject({ free: 2, pro: 10 })
    expect(usageRows(free).map((r) => `${r.key} ${r.used}/${r.limit}`)).toEqual(['members 1/3', 'devices 2/2', 'schedules 0/3'])
    expect(usageRows({ plan: 'FREE', trialDaysLeft: 0, trialing: false })).toEqual([])
  })
})

describe('pantalla Plan y facturación', () => {
  it('en Gratis explica el plan, muestra el uso como "2 de 2 teléfonos" y avisa que no hay pago', () => {
    view(<PlanPage />, { plan: free })
    expect(screen.getAllByText('Gratis')[0]).toBeInTheDocument()
    expect(screen.getByText('2 de 2 teléfonos')).toBeInTheDocument()
    expect(screen.getByRole('progressbar', { name: '2 de 2 teléfonos' })).toHaveAttribute('aria-valuenow', '2')
    expect(screen.getByText('Llegaste al tope')).toBeInTheDocument()
    expect(screen.getByText(/Todavía no se puede pagar desde la app/)).toBeInTheDocument()
    expect(screen.getByText(/Nada se borra/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Escribir a soporte' })).toHaveAttribute('href', '/ayuda')
  })
  it('en prueba dice los días que quedan con calma y compara con lo que tendría Gratis', () => {
    view(<PlanPage />, { plan: trial })
    expect(screen.getByText(/te quedan 12 días/)).toBeInTheDocument()
    expect(screen.getByText(/no tienes que hacer nada ahora/)).toBeInTheDocument()
    expect(screen.getByText('4 de 50 avisos programados')).toBeInTheDocument()
    expect(screen.queryByText(/Gratis · Tu plan/)).not.toBeInTheDocument()
    expect(screen.getByText(/Tu plan/)).toBeInTheDocument()
  })
  it('si el plan no cargó lo dice sin alarmar y ofrece reintentar', () => {
    view(<PlanPage />, { failed: true })
    expect(screen.getByText(/sigues trabajando con normalidad/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument()
  })
})

describe('bloqueo de secciones', () => {
  it('una sección fuera del plan muestra la explicación y no los datos', () => {
    view(<SectionGuard navKey="ventas"><p>datos de ventas</p></SectionGuard>, { plan: free })
    expect(screen.queryByText('datos de ventas')).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Ventas es parte de Pro' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Ver qué incluye Pro' })).toHaveAttribute('href', '/plan')
  })
  it('una sección incluida abre normal', () => {
    view(<SectionGuard navKey="fiados"><p>datos de fiados</p></SectionGuard>, { plan: free })
    expect(screen.getByText('datos de fiados')).toBeInTheDocument()
  })
  it('si el plan falló no se bloquea nada', () => {
    view(<SectionGuard navKey="ventas"><p>datos de ventas</p></SectionGuard>, { failed: true })
    expect(screen.getByText('datos de ventas')).toBeInTheDocument()
  })
  it('un negocio suspendido ve el aviso completo', () => {
    view(<SectionGuard navKey="resumen"><p>datos</p></SectionGuard>, { suspended: true })
    expect(screen.getByRole('heading', { name: 'Este negocio está suspendido' })).toBeInTheDocument()
    expect(screen.queryByText('datos')).not.toBeInTheDocument()
  })
  it('ProGate funciona suelto y en inglés', async () => {
    await act(async () => {
      await setLocale('en')
    })
    view(<ProGate section="reportes" />, {})
    expect(screen.getByRole('heading', { name: 'Reports is part of Pro' })).toBeInTheDocument()
  })
})
