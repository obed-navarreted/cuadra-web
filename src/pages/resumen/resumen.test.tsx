import { act, fireEvent, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { setLocale } from '../../i18n'
import { renderWithBusiness } from '../reportes/testUtils'

const responses = vi.hoisted(() => ({}) as Record<string, unknown>)
vi.mock('../../api/http', () => ({
  client: { GET: (path: string, opts: unknown) => ({ path, opts }) },
  call: async (r: { path: string }) => {
    if (responses[r.path] instanceof Error) throw responses[r.path]
    return responses[r.path]
  },
  downloadFile: vi.fn(),
  ApiError: class extends Error {},
}))

const OVERVIEW = '/api/b/{businessId}/reports/overview'
const RECEIVABLES = '/api/b/{businessId}/reports/receivables'
const DAILY = '/api/b/{businessId}/reports/daily-close'
const daily = { range: {}, days: [{ date: '2026-09-28', startsAt: '2026-09-28T08:00:00Z', endsAt: '2026-09-29T08:00:00Z', salesCount: 4, salesMinor: 45000, byMethod: [], creditCollected: [], drawerExpensesMinor: 0, otherExpensesMinor: 0, withdrawalsMinor: 0, depositsMinor: 0, expectedCashMinor: 32000, cancelledCount: 0, cancelledMinor: 0 }] }

const overview = {
  range: { from: '2026-09-23', to: '2026-09-29', decimals: 2, currency: 'NIO' },
  sales: { count: 3, totalMinor: 53000, discountMinor: 1000, averageTicketMinor: 17667, cancelledCount: 0 },
  byMethod: [],
  profit: { salesMinor: 53000, costOfGoodsMinor: 30000, operatingExpensesMinor: 10000, purchasesExcludedMinor: 4000, estimatedProfitMinor: 13000, costCoveragePercent: 93, formula: 'x' },
  receivableMinor: 17000,
  series: [
    { date: '2026-09-27', salesMinor: 0, expensesMinor: 0 },
    { date: '2026-09-28', salesMinor: 39000, expensesMinor: 2000 },
    { date: '2026-09-29', salesMinor: 14000, expensesMinor: 8000 },
  ],
  topProducts: [
    { productId: 'p1', name: 'Queso', quantityMilli: 3000, revenueMinor: 30000, costMinor: 18000, profitMinor: 12000, fullyCosted: true },
    { productId: null, name: 'Varios', quantityMilli: 1000, revenueMinor: 4000, costMinor: 0, profitMinor: 0, fullyCosted: false },
  ],
  lowStockCount: 1,
  lastClosing: { memberId: 'm1', name: 'Kevin', shifts: 1, differenceMinor: -1000, absoluteDifferenceMinor: 1000, lines: [{ shiftId: 's1', register: 'Caja 1', closedAt: '2026-09-28T20:58:00Z', expectedMinor: 100000, countedMinor: 99000, differenceMinor: -1000 }] },
}
const receivables = {
  totalMinor: 17000,
  openCount: 4,
  buckets: [],
  best: [],
  worst: [
    { customerId: 'c1', name: 'Marta', balanceMinor: 8000, oldestDays: 45, paidLast90Minor: 0 },
    { customerId: 'c2', name: 'Luis', balanceMinor: 7000, oldestDays: 20, paidLast90Minor: 0 },
    { customerId: 'c3', name: 'Ana', balanceMinor: 2000, oldestDays: 90, paidLast90Minor: 0 },
  ],
}

async function load() {
  const { default: ResumenPage } = await import('./index')
  renderWithBusiness(<ResumenPage />)
}

describe('Resumen', () => {
  beforeEach(async () => {
    Object.assign(responses, { [OVERVIEW]: overview, [RECEIVABLES]: receivables, [DAILY]: daily })
    await act(async () => {
      await setLocale('es')
    })
  })

  it('muestra las cifras del servidor con la moneda del negocio y avisa de la cobertura de costo', async () => {
    await load()
    expect(await screen.findByText(/530\.00/)).toBeInTheDocument()
    expect(screen.getByText(/130\.00/)).toBeInTheDocument()
    expect(screen.getByText(/170\.00/)).toBeInTheDocument()
    expect(screen.getByText(/93 % de lo vendido/)).toBeInTheDocument()
    expect(screen.getByText(/3 ventas/)).toBeInTheDocument()
  })

  it('el cierre de ayer muestra la ventana, las ventas y el efectivo esperado, con enlace a Cierre del día', async () => {
    await load()
    expect(await screen.findByText('Cierre de ayer')).toBeInTheDocument()
    expect(await screen.findByText(/Efectivo esperado: .*320\.00/)).toBeInTheDocument()
    expect(screen.getByText(/Ventas: .*450\.00 \(4\)/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Ver cierre del día' })).toHaveAttribute('href', '/cierres')
  })

  it('los fiados más viejos van del más antiguo al más nuevo, sin importar cuánto deben', async () => {
    await load()
    const card = (await screen.findByText('Fiados más viejos')).closest('.card') as HTMLElement
    const names = within(card).getAllByText(/Marta|Luis|Ana/).map((n) => n.textContent)
    expect(names).toEqual(['Ana', 'Marta', 'Luis'])
  })

  it('un producto vendido sin costo no inventa una ganancia', async () => {
    await load()
    expect(await screen.findByText('Varios')).toBeInTheDocument()
    expect(screen.getByText('sin costo')).toBeInTheDocument()
  })

  it('el gráfico tiene una tabla equivalente y un detalle al enfocar un día', async () => {
    await load()
    const days = await screen.findAllByRole('img', { name: /ventas .*, gastos/i })
    expect(days).toHaveLength(3)
    fireEvent.focus(days[1])
    expect(screen.getByRole('status')).toHaveTextContent(/390\.00/)
    fireEvent.click(screen.getByRole('button', { name: 'Ver como tabla' }))
    expect(screen.getAllByRole('row')).toHaveLength(4)
    expect(screen.getByRole('button', { name: 'Ver gráfico' })).toBeInTheDocument()
  })

  it('sin ventas ni gastos no dibuja un gráfico vacío', async () => {
    responses[OVERVIEW] = { ...overview, series: [{ date: '2026-09-29', salesMinor: 0, expensesMinor: 0 }] }
    await load()
    expect(await screen.findByText('No hay ventas ni gastos en este rango.')).toBeInTheDocument()
  })

  it('un error de la API se muestra en lenguaje simple con reintento', async () => {
    responses[OVERVIEW] = new Error('boom')
    await load()
    expect(await screen.findByRole('alert')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument()
  })
})
