import { fireEvent, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { setLocale } from '../../i18n'
import { fail, ok, renderPanel } from '../../test/renderPanel'
import { client } from '../../api/http'
import VentasPage from './index'

vi.mock('../../api/http', async (importOriginal) => ({ ...(await importOriginal<typeof import('../../api/http')>()), client: { GET: vi.fn(), POST: vi.fn(), PUT: vi.fn() } }))

const sale = {
  id: 's1', status: 'COMPLETED', subtotalMinor: 8500, discountMinor: 0, totalMinor: 8500, rev: 1, completedAt: new Date().toISOString(), createdAt: new Date().toISOString(),
  completedBy: { id: 'k', name: 'Kevin' },
  items: [{ id: 'i1', name: 'Queso seco', quantityMilli: 2000, unitPriceMinor: 4250, unitCostMinor: 3000, discountMinor: 0, lineTotalMinor: 8500 }],
  payments: [
    { id: 'p1', method: 'CASH', amountMinor: 5000, tenderedMinor: 6000, changeMinor: 1000 },
    { id: 'p2', method: 'CREDIT', amountMinor: 3500, debtorLabel: 'Doña Karla' },
  ],
}

const queued = {
  id: 'q1', status: 'PARKED', label: 'Mesa 4', subtotalMinor: 12000, discountMinor: 0, totalMinor: 12000, rev: 2, createdAt: new Date().toISOString(),
  createdBy: { id: 'k', name: 'Kevin' }, sentBy: { id: 'k', name: 'Kevin' }, sentToRegisterAt: new Date().toISOString(), pendingCheckout: true,
  items: [{ id: 'i9', name: 'Cerveza', quantityMilli: 2000, unitPriceMinor: 6000, discountMinor: 0, lineTotalMinor: 12000 }], payments: [],
}

const charged = [
  { key: 'l', label: 'Lucía', count: 3, totalMinor: 30000 },
  { key: 'k', label: 'Kevin', count: 1, totalMinor: 10000 },
]
const served = [
  { key: 'k', label: 'Kevin', count: 3, totalMinor: 30000 },
  { key: 'l', label: 'Lucía', count: 1, totalMinor: 10000 },
]

function serve(queue: unknown[] = [], rows: unknown[] = [sale], people: { charged: unknown[]; served: unknown[] } = { charged, served }) {
  vi.mocked(client.GET).mockImplementation(((path: string, opts?: { params?: { query?: { by?: string } } }) => {
    if (path.endsWith('/reports/sales/breakdown')) return ok(opts?.params?.query?.by === 'member_served' ? people.served : people.charged)
    if (path.endsWith('/register-queue')) return ok(queue)
    if (path.endsWith('/members')) return ok([{ id: 'k', displayName: 'Kevin' }])
    if (path.endsWith('/reports/sales')) return ok({ sales: { count: 1, totalMinor: 8500, discountMinor: 0, averageTicketMinor: 8500, cancelledCount: 2 }, byMethod: [{ method: 'CASH', amountMinor: 5000 }, { method: 'CREDIT', amountMinor: 3500 }] })
    return ok({ items: rows, total: rows.length, page: 0, size: 25, last: true })
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

  it('«Promedio por venta» reemplaza al confuso «ticket»', async () => {
    renderPanel(<VentasPage />)
    expect(await screen.findByText('Promedio por venta')).toBeInTheDocument()
    expect(screen.queryByText(/ticket promedio/i)).toBeNull()
  })

  it('«Por persona»: ordenadas con su porcentaje, y tocar una persona filtra la lista (otra vez la quita)', async () => {
    renderPanel(<VentasPage />)
    expect(await screen.findByText('Por persona', { selector: 'h2' })).toBeInTheDocument()
    const rows = await screen.findAllByRole('button', { pressed: false })
    const names = rows.filter((b) => b.classList.contains('people-row')).map((b) => b.querySelector('.people-name')?.textContent)
    expect(names).toEqual(['Lucía', 'Kevin'])
    expect(screen.getByText('3 ventas · 75 %')).toBeInTheDocument()
    expect(screen.getByText('1 venta · 25 %')).toBeInTheDocument()
    // Sin «Cobro en caja» y con el mismo reparto de cobró y atendió… aquí difieren: el control aparece.
    expect(screen.getByRole('tab', { name: 'Cobró' })).toBeInTheDocument()
    fireEvent.click(screen.getByText('Lucía').closest('button') as HTMLElement)
    await waitFor(() => {
      const calls = vi.mocked(client.GET).mock.calls.filter((c) => (c[0] as string).endsWith('/sales'))
      const options = calls[calls.length - 1][1] as unknown as { params: { query: { byMember?: string } } }
      expect(options.params.query.byMember).toBe('l')
    })
    expect(screen.getByText('Lucía').closest('button')).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(screen.getByText('Lucía').closest('button') as HTMLElement)
    await waitFor(() => {
      const calls = vi.mocked(client.GET).mock.calls.filter((c) => (c[0] as string).endsWith('/sales'))
      const options = calls[calls.length - 1][1] as unknown as { params: { query: { byMember?: string } } }
      expect(options.params.query.byMember).toBeUndefined()
    })
  })

  it('«Por persona»: Cobró y Atendió muestran el reparto de cada uno', async () => {
    renderPanel(<VentasPage />)
    await screen.findByText('Por persona', { selector: 'h2' })
    const first = () => Array.from(document.querySelectorAll('.people-row .people-name')).map((n) => n.textContent)
    expect(first()).toEqual(['Lucía', 'Kevin'])
    fireEvent.click(screen.getByRole('tab', { name: 'Atendió' }))
    await waitFor(() => expect(first()).toEqual(['Kevin', 'Lucía']))
    expect(screen.getByText('Quién tomó la cuenta o la envió a caja.')).toBeInTheDocument()
  })

  it('«Por persona»: sin diferencia entre quien cobró y quien atendió no hay control; con 12 personas, 5 y «Ver todos (12)»', async () => {
    const twelve = Array.from({ length: 12 }, (_, i) => ({ key: `m${i}`, label: `Persona ${i + 1}`, count: 1, totalMinor: (12 - i) * 1000 }))
    serve([], [sale], { charged: twelve, served: twelve })
    renderPanel(<VentasPage />)
    await screen.findByText('Por persona', { selector: 'h2' })
    expect(screen.queryByRole('tab', { name: 'Cobró' })).toBeNull()
    expect(document.querySelectorAll('.people-row')).toHaveLength(5)
    fireEvent.click(screen.getByRole('button', { name: 'Ver todos (12)' }))
    expect(document.querySelectorAll('.people-row')).toHaveLength(12)
  })

  it('«Por persona» no se muestra cuando el filtro es solo «eliminadas»', async () => {
    renderPanel(<VentasPage />)
    await screen.findByText('Por persona', { selector: 'h2' })
    fireEvent.change(screen.getByLabelText('Estado'), { target: { value: 'CANCELLED' } })
    await waitFor(() => expect(screen.queryByText('Por persona', { selector: 'h2' })).toBeNull())
  })

  it('muestra «Por cobrar en caja» (solo lectura) y quién atendió y quién cobró', async () => {
    serve([queued], [{ ...sale, createdBy: { id: 'k', name: 'Kevin' }, completedBy: { id: 'a', name: 'Ana' }, sentBy: { id: 'k', name: 'Kevin' }, sentToRegisterAt: new Date().toISOString() }])
    renderPanel(<VentasPage />)
    expect(await screen.findByText('Atendió: Kevin · Cobró: Ana')).toBeInTheDocument()
    expect(await screen.findByText('Por cobrar en caja')).toBeInTheDocument()
    expect(screen.getByText(/^1 cuenta · .*120\.00$/)).toBeInTheDocument()
    fireEvent.click(screen.getByText('Mesa 4').closest('tr') as HTMLElement)
    expect(await screen.findByText('Cuenta por cobrar')).toBeInTheDocument()
    expect(screen.getByText('Cerveza')).toBeInTheDocument()
    // Solo lectura: no hay cómo cobrarla desde la web.
    expect(screen.queryByRole('button', { name: /Cobrar/ })).toBeNull()
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
    const confirm = screen.getByRole('button', { name: 'Eliminar' })
    const reason = await screen.findByLabelText(/^Motivo/)
    fireEvent.change(reason, { target: { value: 'dup' } })
    expect(confirm).toBeDisabled()
    fireEvent.change(reason, { target: { value: 'duplicada' } })
    expect(confirm).toBeEnabled()
    fireEvent.click(confirm)
    await waitFor(() => expect(client.POST).toHaveBeenCalled())
    const [path, options] = vi.mocked(client.POST).mock.calls[0] as unknown as [string, { params: { path: { saleId: string } }; body: { reason: string } }]
    expect(path).toBe('/api/b/{businessId}/sales/{saleId}/cancel')
    expect(options.params.path.saleId).toBe('s1')
    expect(options.body.reason).toBe('duplicada')
  })

  it('si el servidor responde REASON_REQUIRED se explica en el diálogo', async () => {
    vi.mocked(client.POST).mockImplementation((() => fail(400, 'REASON_REQUIRED')) as never)
    renderPanel(<VentasPage />)
    fireEvent.click((await screen.findByText('Kevin', { selector: 'td' })).closest('tr') as HTMLElement)
    fireEvent.click(await screen.findByRole('button', { name: 'Eliminar venta' }))
    fireEvent.change(await screen.findByLabelText(/^Motivo/), { target: { value: 'duplicada' } })
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar' }))
    expect(await screen.findByText(/al menos 5 letras para eliminar una venta cobrada/)).toBeInTheDocument()
  })

  it('el filtro de estado puede incluir las eliminadas: no manda estado y marca las eliminadas', async () => {
    const cancelled = { ...sale, id: 's2', status: 'CANCELLED', cancelledAt: new Date().toISOString(), cancelledBy: { id: 'a', name: 'Ana' }, cancelReason: 'se cobró dos veces' }
    vi.mocked(client.GET).mockImplementation(((path: string) => {
      if (path.endsWith('/members')) return ok([])
      if (path.endsWith('/reports/sales')) return ok({ sales: { count: 1, totalMinor: 8500, discountMinor: 0, averageTicketMinor: 8500, cancelledCount: 1 }, byMethod: [] })
      return ok({ items: [sale, cancelled], total: 2, page: 0, size: 25, last: true })
    }) as never)
    renderPanel(<VentasPage />)
    await screen.findAllByText('Kevin', { selector: 'td' })
    fireEvent.change(screen.getByLabelText('Estado'), { target: { value: 'ALL' } })
    await waitFor(() => {
      const calls = vi.mocked(client.GET).mock.calls.filter((c) => (c[0] as string).endsWith('/sales'))
      const options = calls[calls.length - 1][1] as unknown as { params: { query: { status?: string } } }
      expect(options.params.query.status).toBeUndefined()
    })
    expect(screen.getByText('por Ana')).toBeInTheDocument()
    const rows = screen.getAllByRole('row')
    expect(rows.some((r) => r.classList.contains('row-cancelled'))).toBe(true)
    // El detalle de una eliminada dice quién, cuándo y por qué.
    fireEvent.click(screen.getByText('por Ana').closest('tr') as HTMLElement)
    expect(await screen.findByText('se cobró dos veces')).toBeInTheDocument()
    expect(screen.getByText('Eliminó')).toBeInTheDocument()
    expect(screen.getByText(/^Ana · /)).toBeInTheDocument()
  })

  it('el detalle de una venta editada dice quién y cuándo', async () => {
    vi.mocked(client.GET).mockImplementation(((path: string) => {
      if (path.endsWith('/members')) return ok([])
      if (path.endsWith('/reports/sales')) return ok({ sales: { count: 1, totalMinor: 8500, discountMinor: 0, averageTicketMinor: 8500, cancelledCount: 0 }, byMethod: [] })
      return ok({ items: [{ ...sale, editedAt: new Date().toISOString(), editedBy: { id: 'a', name: 'Ana' } }], total: 1, page: 0, size: 25, last: true })
    }) as never)
    renderPanel(<VentasPage />)
    fireEvent.click((await screen.findByText('Kevin', { selector: 'td' })).closest('tr') as HTMLElement)
    expect(await screen.findByText('Editó')).toBeInTheDocument()
    expect(screen.getByText(/^Ana · /)).toBeInTheDocument()
  })

  it('devolver productos: se elige la cantidad, el motivo y cómo se devuelve el dinero, y se manda la devolución', async () => {
    vi.mocked(client.PUT).mockImplementation((() => ok({ id: 'r1', totalMinor: 4250 })) as never)
    renderPanel(<VentasPage />)
    fireEvent.click((await screen.findByText('Kevin', { selector: 'td' })).closest('tr') as HTMLElement)
    fireEvent.click(await screen.findByRole('button', { name: 'Devolver productos' }))
    const qty = await screen.findByLabelText('Cantidad a devolver de Queso seco')
    fireEvent.change(qty, { target: { value: '3' } })
    expect(screen.getByText(/No puedes devolver más/)).toBeInTheDocument()
    fireEvent.change(qty, { target: { value: '1' } })
    // La venta fue en parte a fiado: se puede bajar el fiado.
    fireEvent.click(screen.getByRole('radio', { name: /Bajar el fiado/ }))
    const confirm = screen.getByRole('button', { name: /^Devolver .*42\.50/ })
    expect(confirm).toBeDisabled()
    fireEvent.change(screen.getByLabelText(/^Motivo/), { target: { value: 'venía roto' } })
    expect(confirm).toBeEnabled()
    fireEvent.click(confirm)
    await waitFor(() => expect(client.PUT).toHaveBeenCalled())
    const [path, options] = vi.mocked(client.PUT).mock.calls[0] as unknown as [string, { params: { path: { saleId: string; returnId: string } }; body: { items: { saleItemId: string; quantityMilli: number }[]; reason: string; refundMethod: string } }]
    expect(path).toBe('/api/b/{businessId}/sales/{saleId}/returns/{returnId}')
    expect(options.params.path.saleId).toBe('s1')
    expect(options.params.path.returnId).toMatch(/^[0-9a-f-]{36}$/)
    expect(options.body).toEqual({ items: [{ saleItemId: 'i1', quantityMilli: 1000 }], reason: 'venía roto', refundMethod: 'CREDIT_NOTE' })
  })

  it('marca las ventas para revisar y muestra sus devoluciones', async () => {
    const flagged = {
      ...sale, id: 's3', conflictOfSaleId: 's0', reviewFlag: 'LATE_AFTER_DISABLE', returnedMinor: 4250,
      items: [{ ...sale.items[0], returnedMilli: 1000 }],
      returns: [{ id: 'r1', saleId: 's3', reason: 'venía roto', refundMethod: 'CASH', totalMinor: 4250, occurredAt: new Date().toISOString(), createdBy: { id: 'a', name: 'Ana' }, items: [{ id: 'x', saleItemId: 'i1', name: 'Queso seco', quantityMilli: 1000, amountMinor: 4250 }], refunds: [{ method: 'CASH', amountMinor: 4250 }] }],
    }
    vi.mocked(client.GET).mockImplementation(((path: string) => {
      if (path.endsWith('/members')) return ok([])
      if (path.endsWith('/reports/sales')) return ok({ sales: { count: 1, totalMinor: 8500, discountMinor: 0, averageTicketMinor: 8500, cancelledCount: 0, returnsMinor: 4250, returnsCount: 1, priorCancelledMinor: 0, priorCancelledCount: 0, netMinor: 4250 }, byMethod: [] })
      return ok({ items: [flagged], total: 1, page: 0, size: 25, last: true })
    }) as never)
    renderPanel(<VentasPage />)
    expect(await screen.findByText('Conflicto: revisar')).toBeInTheDocument()
    expect(screen.getByText('Llegó después de la baja')).toBeInTheDocument()
    expect(screen.getByText('Neto del periodo')).toBeInTheDocument()
    fireEvent.click(screen.getByText('Conflicto: revisar').closest('tr') as HTMLElement)
    expect(await screen.findByText('Devoluciones')).toBeInTheDocument()
    expect(screen.getByText('Motivo: venía roto')).toBeInTheDocument()
    // Con devoluciones ya no se elimina entera (se devuelve el resto).
    expect(screen.queryByRole('button', { name: 'Eliminar venta' })).not.toBeInTheDocument()
  })
})
