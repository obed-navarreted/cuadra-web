import { screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { client } from '../../api/http'
import { setLocale } from '../../i18n'
import { ok, renderPanel } from '../../test/renderPanel'
import CierresPage from './index'

vi.mock('../../api/http', async (importOriginal) => ({ ...(await importOriginal<typeof import('../../api/http')>()), client: { GET: vi.fn(), POST: vi.fn() } }))

const day = (date: string, startsAt: string, endsAt: string, over = {}) => ({
  date, startsAt, endsAt, salesCount: 3, salesMinor: 30000, byMethod: [{ method: 'CASH', amountMinor: 20000 }, { method: 'CARD', amountMinor: 10000 }],
  creditCollected: [{ method: 'CASH', amountMinor: 1000 }], drawerExpensesMinor: 2000, otherExpensesMinor: 500, withdrawalsMinor: 5000, depositsMinor: 0,
  expectedCashMinor: 14000, cancelledCount: 0, cancelledMinor: 0, ...over,
})

describe('Cierre del día', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    await setLocale('es')
    vi.mocked(client.GET).mockImplementation((() =>
      ok({
        range: {},
        days: [
          day('2026-09-28', '2026-09-28T08:00:00Z', '2026-09-29T08:00:00Z'),
          day('2026-09-29', '2026-09-29T08:00:00Z', '2026-09-30T08:00:00Z', { cancelledCount: 1, cancelledMinor: 4000, salesCount: 1, salesMinor: 5000, byMethod: [{ method: 'CASH', amountMinor: 5000 }], creditCollected: [], drawerExpensesMinor: 0, otherExpensesMinor: 0, withdrawalsMinor: 0, expectedCashMinor: 5000 }),
        ],
      })) as never)
  })

  it('una tarjeta por jornada con su ventana exacta, el efectivo esperado y la fórmula; sin abrir ni contar', async () => {
    renderPanel(<CierresPage />)
    expect(await screen.findByRole('heading', { name: 'Total del periodo (2 días)' })).toBeInTheDocument()
    expect(screen.getAllByText(/^28 sept? 2:00\sa\.\sm\. → 29 sept? 2:00\sa\.\sm\.$/)).toHaveLength(1)
    expect(screen.getAllByText('Efectivo esperado').length).toBeGreaterThanOrEqual(3)
    expect(screen.getAllByText(/ventas en efectivo \+ .* abonos en efectivo/).length).toBe(3)
    expect(screen.getAllByText(/1 venta eliminada/)).toHaveLength(2)
    expect(screen.queryByText(/Abrir|Contado|Reabrir/)).not.toBeInTheDocument()
    const call = vi.mocked(client.GET).mock.calls[0]
    expect(call[0]).toBe('/api/b/{businessId}/reports/daily-close')
  })

  it('avisa de las cuentas que quedan por cobrar en caja al terminar la jornada', async () => {
    vi.mocked(client.GET).mockImplementation((() =>
      ok({ range: {}, days: [day('2026-09-29', '2026-09-29T08:00:00Z', '2026-09-30T08:00:00Z', { pendingCheckoutCount: 1, pendingCheckoutMinor: 12000 })] })) as never)
    renderPanel(<CierresPage />)
    expect(await screen.findByText(/^Queda 1 cuenta por cobrar en caja \(.*120\.00\)/)).toBeInTheDocument()
  })

  it('muestra devoluciones, ventas de días anteriores anuladas, anulaciones tardías y avisa de teléfonos sin sincronizar', async () => {
    vi.mocked(client.GET).mockImplementation((() =>
      ok({
        range: {},
        syncWarnings: [{ deviceId: 'd1', name: 'Caja de Ana', pendingOps: 4, stale: false }, { deviceId: 'd2', name: 'Tablet', pendingOps: 0, stale: true, lastSyncAt: '2026-09-29T10:00:00Z' }],
        days: [
          day('2026-09-29', '2026-09-29T08:00:00Z', '2026-09-30T08:00:00Z', {
            returnsCount: 1, returnsMinor: 9000, cashRefundsMinor: 9000, refundsByMethod: [{ method: 'CASH', amountMinor: 9000 }],
            priorCancelledCount: 1, priorCancelledMinor: 4000, priorCancelledCashMinor: 4000, netSalesMinor: 17000,
            laterVoids: [{ kind: 'EXPENSE_DRAWER', count: 1, amountMinor: 1500, cashEffectMinor: 1500 }],
          }),
        ],
      })) as never)
    renderPanel(<CierresPage />)
    expect(await screen.findByText(/Hay 4 operaciones sin sincronizar en Caja de Ana/)).toBeInTheDocument()
    expect(screen.getByText(/Tablet no se sincroniza desde/)).toBeInTheDocument()
    expect(screen.getByText('Devoluciones (1)')).toBeInTheDocument()
    expect(screen.getByText('Ventas anuladas de días anteriores (1)')).toBeInTheDocument()
    expect(screen.getByText('Neto del día')).toBeInTheDocument()
    expect(screen.getByText('Devuelto en efectivo')).toBeInTheDocument()
    expect(screen.getByText('Gasto del cajón de días anteriores anulado')).toBeInTheDocument()
    expect(screen.getByText(/^Además hoy:/)).toBeInTheDocument()
  })
})

