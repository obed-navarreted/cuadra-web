import { fireEvent, screen, waitFor } from '@testing-library/react'
import { Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { client } from '../../api/http'
import { setLocale } from '../../i18n'
import { ok, renderPanel } from '../../test/renderPanel'
import CierresPage from './index'

vi.mock('../../api/http', async (importOriginal) => ({ ...(await importOriginal<typeof import('../../api/http')>()), client: { GET: vi.fn(), POST: vi.fn() } }))

const now = new Date().toISOString()
const shift = {
  id: 's1', registerName: 'Caja 1', openedAt: now, closedAt: now, openedBy: { id: 'k', name: 'Kevin' }, closedBy: { id: 'k', name: 'Kevin' }, openingFloatMinor: 100000,
  expectedAtCloseMinor: 125000, countedMinor: 124000, differenceMinor: -1000, status: 'CLOSED', lateOps: 1, reopenedCount: 0, rev: 1,
}
const detail = { ...shift, breakdown: { cashSalesMinor: 30000, cashSalesCount: 1, creditPaymentsCashMinor: 0, depositsMinor: 0, expensesCashMinor: 5000, withdrawalsMinor: 0, expectedNowMinor: 125000, transferMinor: 0, cardMinor: 0, otherMinor: 0, creditNewMinor: 0, cancelledCount: 0 } }

function serve() {
  vi.mocked(client.GET).mockImplementation(((path: string) => {
    if (path.endsWith('/members')) return ok([{ id: 'k', displayName: 'Kevin' }])
    if (path.endsWith('/shifts/{shiftId}')) return ok(detail)
    return ok({ items: [shift], total: 1, page: 0, size: 100, last: true })
  }) as never)
  vi.mocked(client.POST).mockImplementation((() => ok({ ...shift, status: 'OPEN' })) as never)
}

const page = (
  <Routes>
    <Route path="/cierres/*" element={<CierresPage />} />
  </Routes>
)

describe('Cierres', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    await setLocale('es')
    serve()
  })

  it('muestra el historial con la diferencia y los avisos del turno', async () => {
    renderPanel(page, { path: '/cierres' })
    expect(await screen.findByText('Caja 1')).toBeInTheDocument()
    expect(screen.getAllByText(/Falta/).length).toBeGreaterThan(0)
    expect(screen.getByText('1 operación tardía')).toBeInTheDocument()
  })

  it('abrir un cierre por su enlace muestra el desglose con lo que debe haber ahora y lo que se firmó', async () => {
    renderPanel(page, { path: '/cierres/s1' })
    expect(await screen.findByText('Fondo inicial')).toBeInTheDocument()
    expect(screen.getByText('Ventas en efectivo (1)')).toBeInTheDocument()
    expect(screen.getByText('Debe haber ahora (con todo lo recibido)')).toBeInTheDocument()
    expect(screen.getByText('Debía haber al cerrar (lo que se firmó)')).toBeInTheDocument()
  })

  it('solo el dueño ve "Reabrir turno" y lo hace con un motivo obligatorio', async () => {
    renderPanel(page, { path: '/cierres/s1' })
    fireEvent.click(await screen.findByRole('button', { name: 'Reabrir turno' }))
    const confirm = await screen.findByRole('button', { name: 'Reabrir' })
    expect(confirm).toBeDisabled()
    fireEvent.change(screen.getByLabelText('Motivo'), { target: { value: 'se contó mal' } })
    fireEvent.click(confirm)
    await waitFor(() => expect(client.POST).toHaveBeenCalled())
    const [path, options] = vi.mocked(client.POST).mock.calls[0] as unknown as [string, { body: { reason: string } }]
    expect(path).toBe('/api/b/{businessId}/shifts/{shiftId}/reopen')
    expect(options.body.reason).toBe('se contó mal')
  })

  it('un administrador no ve la opción de reabrir', async () => {
    renderPanel(page, { path: '/cierres/s1', auth: { isOwner: false } })
    await screen.findByText('Fondo inicial')
    expect(screen.queryByRole('button', { name: 'Reabrir turno' })).not.toBeInTheDocument()
  })
})
