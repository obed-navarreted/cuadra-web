import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { setLocale } from '../../i18n'
import { renderWithBusiness } from './testUtils'

const mocks = vi.hoisted(() => ({ responses: {} as Record<string, unknown>, calls: [] as { path: string; query?: Record<string, unknown> }[], download: vi.fn() }))
vi.mock('../../api/http', () => ({
  client: { GET: (path: string, opts?: { params?: { query?: Record<string, unknown> } }) => ({ path, query: opts?.params?.query }) },
  call: async (r: { path: string; query?: Record<string, unknown> }) => {
    mocks.calls.push(r)
    const v = mocks.responses[r.path]
    return typeof v === 'function' ? (v as (q?: Record<string, unknown>) => unknown)(r.query) : v
  },
  downloadFile: mocks.download,
  ApiError: class extends Error {},
}))

const P = (name: string) => `/api/b/{businessId}/reports/${name}`

async function open(tab: string) {
  const { default: ReportesPage } = await import('./index')
  renderWithBusiness(<ReportesPage />, `/reportes?tab=${tab}`)
}

beforeEach(async () => {
  mocks.calls.length = 0
  mocks.download.mockReset()
  await act(async () => {
    await setLocale('es')
  })
  Object.assign(mocks.responses, {
    [P('sales')]: { sales: { count: 3, totalMinor: 53000, discountMinor: 1000, averageTicketMinor: 17667, cancelledCount: 2 } },
    [P('sales/breakdown')]: [
      { key: 'CASH', label: 'CASH', count: 2, totalMinor: 30000 },
      { key: 'CARD', label: 'CARD', count: 1, totalMinor: 14000 },
    ],
    [P('profit')]: { salesMinor: 53000, costOfGoodsMinor: 30000, operatingExpensesMinor: 10000, purchasesExcludedMinor: 4000, estimatedProfitMinor: 13000, costCoveragePercent: 93, formula: 'SERVER TEXT' },
    [P('products')]: [
      { productId: 'p1', name: 'Queso', quantityMilli: 3000, revenueMinor: 30000, costMinor: 18000, profitMinor: 12000, fullyCosted: true },
      { productId: null, name: 'Varios', quantityMilli: 1000, revenueMinor: 4000, costMinor: 0, profitMinor: 0, fullyCosted: false },
    ],
    [P('receivables')]: {
      totalMinor: 17000,
      openCount: 1,
      buckets: [
        { key: '0-15', fromDays: 0, toDays: 15, amountMinor: 5000, count: 1 },
        { key: '60+', fromDays: 61, amountMinor: 2000, count: 3 },
      ],
      worst: [{ customerId: 'c1', name: 'Marta', balanceMinor: 8000, oldestDays: 1, paidLast90Minor: 500 }],
      best: [{ customerId: 'c2', name: 'Luis', balanceMinor: 0, oldestDays: 0, paidLast90Minor: 99900 }],
    },
    [P('expenses')]: {
      operatingMinor: 10000,
      purchasesMinor: 4000,
      cashDrawerMinor: 6000,
      otherMinor: 8000,
      byCategory: [
        { categoryId: 'k1', key: 'rent', amountMinor: 8000 },
        { categoryId: 'k2', name: 'Publicidad', amountMinor: 1500 },
        { amountMinor: 500 },
      ],
    },
    [P('closings')]: [
      { memberId: 'm1', name: 'Kevin', shifts: 2, differenceMinor: -1000, absoluteDifferenceMinor: 1500, lines: [{ shiftId: 's1', register: 'Caja 1', closedAt: '2026-09-28T20:58:00Z', expectedMinor: 100000, countedMinor: 99000, differenceMinor: -1000 }] },
    ],
    [P('inventory')]: {
      valueAtCostMinor: 12000,
      trackedCount: 3,
      trackedWithoutCost: 1,
      low: [{ productId: 'p1', name: 'Pan', unit: 'UNIT', stockMilli: -2000, minStockMilli: 1000 }],
      noMovement: [{ productId: 'p2', name: 'Sal', unit: 'LB', stockMilli: 5500, costMinor: 300 }],
    },
  })
})

describe('Reportes', () => {
  it('abre la pestaña que pide la dirección y las demás se cambian con un toque', async () => {
    await open('profit')
    expect(await screen.findByText('Cómo se calcula')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('tab', { name: 'Productos' }))
    expect(await screen.findByText('Queso')).toBeInTheDocument()
  })

  it('una pestaña desconocida cae en Ventas', async () => {
    await open('nope')
    expect(await screen.findByText('Por persona', { selector: 'h2' })).toBeInTheDocument()
  })

  it('ventas: traduce el método de pago, calcula el porcentaje y pide el desglose que se eligió', async () => {
    await open('sales')
    fireEvent.click(await screen.findByRole('tab', { name: 'Por método de pago' }))
    expect(await screen.findByText('Efectivo')).toBeInTheDocument()
    expect(screen.getByText('Tarjeta')).toBeInTheDocument()
    expect(screen.getByText('68 %')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('tab', { name: 'Por hora' }))
    await waitFor(() => expect(mocks.calls.some((c) => c.path === P('sales/breakdown') && c.query?.by === 'hour')).toBe(true))
  })

  it('ventas: «Promedio por venta» (no «ticket») y el control Cobró / Atendió pide member_served', async () => {
    const charged = [{ key: 'l', label: 'Lucía', count: 3, totalMinor: 30000 }, { key: 'k', label: 'Kevin', count: 1, totalMinor: 10000 }]
    const served = [{ key: 'k', label: 'Kevin', count: 3, totalMinor: 30000 }, { key: 'l', label: 'Lucía', count: 1, totalMinor: 10000 }]
    mocks.responses[P('sales/breakdown')] = (q?: Record<string, unknown>) => (q?.by === 'member_served' ? served : charged)
    await open('sales')
    expect(await screen.findByText('Promedio por venta')).toBeInTheDocument()
    expect(screen.queryByText(/ticket/i)).toBeNull()
    expect(await screen.findByText('Lucía')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('tab', { name: 'Atendió' }))
    await waitFor(() => expect(mocks.calls.some((c) => c.path === P('sales/breakdown') && c.query?.by === 'member_served')).toBe(true))
    expect(await screen.findByText('Quién tomó la cuenta o la envió a caja.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('tab', { name: 'Por método de pago' }))
    await waitFor(() => expect(screen.queryByRole('tab', { name: 'Atendió' })).toBeNull())
  })

  it('ventas: sin diferencia entre quien cobró y quien atendió no hay control', async () => {
    mocks.responses[P('sales/breakdown')] = [{ key: 'k', label: 'Kevin', count: 2, totalMinor: 30000 }]
    await open('sales')
    expect(await screen.findByText('Kevin')).toBeInTheDocument()
    expect(screen.queryByRole('tab', { name: 'Atendió' })).toBeNull()
  })

  it('ganancia: muestra la fórmula traducida y NO el texto del servidor, con el desglose', async () => {
    await open('profit')
    expect(await screen.findByText(/ganancia = ventas − costo de lo vendido − gastos operativos/)).toBeInTheDocument()
    expect(screen.queryByText('SERVER TEXT')).not.toBeInTheDocument()
    expect(screen.getByText('= Ganancia estimada').parentElement).toHaveTextContent(/130\.00/)
    expect(screen.getByText('Compras de mercadería no incluidas')).toBeInTheDocument()
    expect(screen.getAllByText(/93 %/).length).toBeGreaterThan(0)
  })

  it('ganancia en inglés usa la fórmula en inglés', async () => {
    await act(async () => {
      await setLocale('en')
    })
    await open('profit')
    expect(await screen.findByText(/profit = sales − cost of goods sold − operating expenses/)).toBeInTheDocument()
  })

  it('productos: marca lo vendido sin costo', async () => {
    await open('products')
    expect(await screen.findByText('sin costo en algunas ventas')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('tab', { name: 'Por ganancia' }))
    await waitFor(() => expect(mocks.calls.some((c) => c.path === P('products') && c.query?.sort === 'profit')).toBe(true))
  })

  it('por cobrar: cuatro tramos con su nombre y, en mejores pagadores, primero lo que pagaron', async () => {
    await open('receivables')
    expect(await screen.findByText('0–15 días')).toBeInTheDocument()
    expect(screen.getByText('Más de 60 días')).toBeInTheDocument()
    const best = screen.getByText('Mejores pagadores (últimos 90 días)').closest('.card') as HTMLElement
    const headers = within(best).getAllByRole('columnheader').map((h) => h.textContent)
    expect(headers[1]).toBe('Pagó en 90 días')
    expect(screen.queryByText('Fecha')).not.toBeInTheDocument()
  })

  it('gastos: traduce las categorías de fábrica, respeta el nombre propio y no inventa uno', async () => {
    await open('expenses')
    expect(await screen.findByText('Alquiler')).toBeInTheDocument()
    expect(screen.getByText('Publicidad')).toBeInTheDocument()
    expect(screen.getByText('Sin categoría')).toBeInTheDocument()
  })

  it('cierres: la diferencia por persona y el detalle de cada cierre', async () => {
    await open('closings')
    expect(await screen.findByText('Kevin', { selector: 'td' })).toBeInTheDocument()
    expect(screen.getByText(/Ver los 2 cierres/)).toBeInTheDocument()
    expect(screen.getAllByText(/Faltó/).length).toBeGreaterThan(0)
  })

  it('inventario: el stock negativo se marca y las unidades se traducen', async () => {
    await open('inventory')
    expect(await screen.findByText('negativo')).toBeInTheDocument()
    // En español el decimal es la coma: el formato sigue al idioma de la interfaz.
    expect(screen.getByText(/5,5 lb/)).toBeInTheDocument()
    expect(screen.getByText('Sin costo anotado')).toBeInTheDocument()
  })

  it('cada CSV se pide con el rango elegido y el idioma de la interfaz', async () => {
    await open('sales')
    fireEvent.click(await screen.findByRole('button', { name: 'Ventas (CSV)' }))
    await waitFor(() => expect(mocks.download).toHaveBeenCalled())
    const [path, params] = mocks.download.mock.calls[0]
    expect(path).toBe('/api/b/b1/reports/sales.csv')
    expect(params).toMatchObject({ lang: 'es' })
    expect(params.from).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(params.to >= params.from).toBe(true)
  })

  it('si la descarga falla, lo dice sin ocultar el reporte', async () => {
    mocks.download.mockRejectedValueOnce(new Error('x'))
    await open('inventory')
    fireEvent.click(await screen.findByRole('button', { name: 'Descargar CSV' }))
    expect(await screen.findByText('No se pudo descargar el archivo.')).toBeInTheDocument()
    expect(screen.getByText('Valor al costo')).toBeInTheDocument()
  })
})
