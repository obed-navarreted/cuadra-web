import { fireEvent, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { setLocale } from '../../i18n'
import { ok, renderPanel } from '../../test/renderPanel'
import { client } from '../../api/http'
import VentasPage from './index'

vi.mock('../../api/http', async (importOriginal) => ({ ...(await importOriginal<typeof import('../../api/http')>()), client: { GET: vi.fn(), POST: vi.fn() } }))

const sale = {
  id: 's1', status: 'COMPLETED', subtotalMinor: 8500, discountMinor: 0, totalMinor: 8500, rev: 1, completedAt: new Date().toISOString(), createdAt: new Date().toISOString(),
  completedBy: { id: 'k', name: 'Kevin' },
  items: [{ id: 'i1', name: 'Queso seco', quantityMilli: 2000, unitPriceMinor: 4250, unitCostMinor: 3000, discountMinor: 0, lineTotalMinor: 8500 }],
  payments: [
    { id: 'p1', method: 'CASH', amountMinor: 5000, tenderedMinor: 6000, changeMinor: 1000 },
    { id: 'p2', method: 'CREDIT', amountMinor: 3500, debtorLabel: 'Doña Karla' },
  ],
}

function serve() {
  vi.mocked(client.GET).mockImplementation(((path: string) => {
    if (path.endsWith('/members')) return ok([{ id: 'k', displayName: 'Kevin' }])
    if (path.endsWith('/reports/sales')) return ok({ sales: { count: 1, totalMinor: 8500, discountMinor: 0, averageTicketMinor: 8500, cancelledCount: 2 }, byMethod: [{ method: 'CASH', amountMinor: 5000 }, { method: 'CREDIT', amountMinor: 3500 }] })
    return ok({ items: [sale], total: 1, page: 0, size: 25, last: true })
  }) as never)
  vi.mocked(client.POST).mockImplementation((() => ok({ ...sale, status: 'CANCELLED' })) as never)
}

describe('Ventas', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    await setLocale('es')
    serve()
  })

  it('lista las ventas con sus métodos y muestra los totales del periodo', async () => {
    renderPanel(<VentasPage />)
    expect(await screen.findByText('Kevin', { selector: 'td' })).toBeInTheDocument()
    expect(screen.getAllByText('Fiado').length).toBeGreaterThan(0)
    expect(screen.getAllByText(/85\.00/).length).toBeGreaterThan(0)
    // Ventas eliminadas del periodo viene del reporte, no de la página.
    expect(await screen.findByText('Ventas eliminadas')).toBeInTheDocument()
  })

  it('pide las ventas con el estado y el rango elegidos', async () => {
    renderPanel(<VentasPage />)
    await screen.findByText('Kevin', { selector: 'td' })
    fireEvent.change(screen.getByLabelText('Estado'), { target: { value: 'CANCELLED' } })
    await waitFor(() => {
      const calls = vi.mocked(client.GET).mock.calls.filter((c) => (c[0] as string).endsWith('/sales'))
      expect(calls.length).toBeGreaterThan(0)
      const options = calls[calls.length - 1][1] as unknown as { params: { query: { status: string } } }
      expect(options.params.query.status).toBe('CANCELLED')
    })
  })

  it('el detalle muestra líneas con costo, el vuelto y el fiado generado', async () => {
    renderPanel(<VentasPage />)
    fireEvent.click((await screen.findByText('Kevin', { selector: 'td' })).closest('tr') as HTMLElement)
    expect(await screen.findByText('Queso seco')).toBeInTheDocument()
    expect(screen.getByText(/Fiado a Doña Karla/)).toBeInTheDocument()
    expect(screen.getByText(/vuelto/)).toBeInTheDocument()
    expect(screen.getByText('Costo de lo vendido')).toBeInTheDocument()
  })

  it('eliminar una venta pide confirmación y manda el motivo', async () => {
    renderPanel(<VentasPage />)
    fireEvent.click((await screen.findByText('Kevin', { selector: 'td' })).closest('tr') as HTMLElement)
    fireEvent.click(await screen.findByRole('button', { name: 'Eliminar venta' }))
    fireEvent.change(await screen.findByLabelText('Motivo (opcional)'), { target: { value: 'duplicada' } })
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar' }))
    await waitFor(() => expect(client.POST).toHaveBeenCalled())
    const [path, options] = vi.mocked(client.POST).mock.calls[0] as unknown as [string, { params: { path: { saleId: string } }; body: { reason: string } }]
    expect(path).toBe('/api/b/{businessId}/sales/{saleId}/cancel')
    expect(options.params.path.saleId).toBe('s1')
    expect(options.body.reason).toBe('duplicada')
  })
})
