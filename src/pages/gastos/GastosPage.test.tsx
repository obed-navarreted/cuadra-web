import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { client } from '../../api/http'
import { setLocale } from '../../i18n'
import { fail, ok, renderPanel } from '../../test/renderPanel'
import GastosPage from './index'

vi.mock('../../api/http', async (importOriginal) => ({ ...(await importOriginal<typeof import('../../api/http')>()), client: { GET: vi.fn(), POST: vi.fn(), PUT: vi.fn() } }))

const at = new Date().toISOString()
const expenses = [
  { id: 'e1', amountMinor: 6000, source: 'CASH_DRAWER', description: 'Compra · Lácteos', categoryKey: 'goods', createdByName: 'Ana', occurredAt: at, voided: false, rev: 1 },
  { id: 'e2', amountMinor: 999, source: 'OTHER', description: 'Error de captura', createdByName: 'Ana', occurredAt: at, voided: true, voidReason: 'duplicado', rev: 2 },
]

function serve() {
  vi.mocked(client.GET).mockImplementation(((path: string) => {
    if (path.endsWith('/expense-categories')) return ok([{ id: 'c1', key: 'goods', active: true, rev: 1 }, { id: 'c2', key: 'rent', active: true, rev: 1 }])
    if (path.endsWith('/expenses/summary')) return ok({ from: '', to: '', cashDrawerMinor: 6000, otherMinor: 0, count: 1, byCategory: [{ categoryId: 'c1', key: 'goods', amountMinor: 6000 }] })
    return ok({ items: expenses, total: 2, page: 0, size: 50, last: true })
  }) as never)
  vi.mocked(client.PUT).mockImplementation((() => ok({})) as never)
  vi.mocked(client.POST).mockImplementation((() => ok({})) as never)
}

/** Hay varios diálogos montados (cerrados); el que importa es el abierto. */
async function openDialog(): Promise<HTMLElement> {
  return waitFor(() => {
    const d = document.querySelector('dialog[open]')
    if (!d) throw new Error('no hay un diálogo abierto')
    return d as HTMLElement
  })
}

describe('Gastos', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    await setLocale('es')
    serve()
  })

  it('separa lo que salió del cajón de lo demás y muestra los anulados aparte, sin sumarlos', async () => {
    renderPanel(<GastosPage />)
    expect(await screen.findByText('Compra · Lácteos', { selector: 'td' })).toBeInTheDocument()
    expect(screen.getByText('Salió del cajón')).toBeInTheDocument()
    expect(screen.getByText('Anulados (1)')).toBeInTheDocument()
    expect(screen.getByText('duplicado')).toBeInTheDocument()
    // La categoría de fábrica se muestra traducida, no como su clave.
    expect(screen.getAllByText('Mercadería').length).toBeGreaterThan(0)
  })

  it('registrar un gasto valida el monto y manda la unidad menor con su origen', async () => {
    renderPanel(<GastosPage />)
    await screen.findByText('Compra · Lácteos', { selector: 'td' })
    fireEvent.click(screen.getByRole('button', { name: 'Registrar gasto' }))
    const dialog = await openDialog()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Guardar' }))
    expect(await within(dialog).findByText('Escribe un monto mayor que cero.')).toBeInTheDocument()
    expect(client.PUT).not.toHaveBeenCalled()
    fireEvent.change(within(dialog).getByLabelText(/^Monto/), { target: { value: '12,50' } })
    fireEvent.change(within(dialog).getByLabelText('Categoría'), { target: { value: 'c2' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Guardar' }))
    await waitFor(() => expect(client.PUT).toHaveBeenCalled())
    const [path, options] = vi.mocked(client.PUT).mock.calls[0] as unknown as [string, { body: { amountMinor: number; source: string; categoryId: string; occurredAt?: string } }]
    expect(path).toBe('/api/b/{businessId}/expenses/{expenseId}')
    expect(options.body).toMatchObject({ amountMinor: 1250, source: 'BANK', categoryId: 'c2' })
    expect(options.body.occurredAt).toBeUndefined()
  })

  it('anular un gasto ligado a un pago a proveedor explica que hay que anular el pago', async () => {
    vi.mocked(client.POST).mockImplementation((() => fail(409, 'EXPENSE_LINKED')) as never)
    renderPanel(<GastosPage />)
    await screen.findByText('Compra · Lácteos', { selector: 'td' })
    fireEvent.click(screen.getByRole('button', { name: 'Anular' }))
    const dialog = await openDialog()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Anular' }))
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('anula el pago desde Compras')
  })

  it('las categorías se pueden ocultar y renombrar', async () => {
    renderPanel(<GastosPage />)
    fireEvent.click(await screen.findByRole('tab', { name: 'Categorías' }))
    fireEvent.click((await screen.findAllByRole('button', { name: 'Ocultar' }))[0])
    await waitFor(() => expect(client.PUT).toHaveBeenCalled())
    const [path, options] = vi.mocked(client.PUT).mock.calls[0] as unknown as [string, { params: { path: { categoryId: string } }; body: { active: boolean } }]
    expect(path).toBe('/api/b/{businessId}/expense-categories/{categoryId}')
    expect(options.params.path.categoryId).toBe('c1')
    expect(options.body.active).toBe(false)
  })
})
