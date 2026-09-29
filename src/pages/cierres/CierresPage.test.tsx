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
})
