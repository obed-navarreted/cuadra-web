import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { act } from 'react'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { setLocale } from '../../i18n'
import * as api from './api'
import { ImportTab } from './ImportTab'
import { ProductsTab } from './ProductsTab'
import { PurchasesTab } from './PurchasesTab'
import type { Product } from './types'

vi.mock('./api')
vi.mock('../../auth/context', () => ({
  useBusiness: () => ({
    membership: { businessId: 'b1', role: 'OWNER' },
    business: { id: 'b1', currency: 'NIO', country: 'NI', timezone: 'America/Managua', dayCutoff: '02:00:00', modules: { inventory: true } },
  }),
}))

// jsdom no trae <dialog>.showModal(): se simula lo mínimo (abrir y cerrar).
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', '') }
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open') }
})

beforeEach(async () => {
  vi.resetAllMocks()
  await act(async () => {
    await setLocale('es')
  })
})

const product = (over: Partial<Product>): Product => ({ id: 'p', name: 'X', priceMinor: 1000, unit: 'UNIT', pricing: 'FIXED', isQuick: false, trackStock: false, stockMilli: 0, active: true, rev: 1, ...over })

describe('ImportTab', () => {
  const paste = (text: string) => fireEvent.change(screen.getByLabelText(/O pega aquí/), { target: { value: text } })

  it('detecta el separador y las columnas, y la vista previa NO guarda (dryRun)', async () => {
    vi.mocked(api.importProducts).mockResolvedValue({ dryRun: true, summary: { total: 2, created: 1, updated: 0, failed: 1 }, rows: [{ line: 2, name: 'Queso', status: 'CREATE' }, { line: 3, name: 'Mala', status: 'ERROR', code: 'INVALID_PRICE' }] })
    render(<ImportTab inventory onChanged={() => {}} />)
    paste('Nombre;Precio;Existencia\nQueso;90,50;12\nMala;abc;')
    expect(screen.getByText(/2 filas de datos, separadas por punto y coma/)).toBeInTheDocument()
    const selects = screen.getAllByRole('combobox') as HTMLSelectElement[]
    expect(selects.map((s) => s.value)).toEqual(['name', 'price', 'stock'])

    fireEvent.click(screen.getByRole('button', { name: 'Ver vista previa' }))
    await screen.findByText('Vista previa')
    expect(api.importProducts).toHaveBeenCalledTimes(1)
    expect(api.importProducts).toHaveBeenCalledWith('b1', [{ line: 2, name: 'Queso', price: '90,50', stock: '12' }, { line: 3, name: 'Mala', price: 'abc' }], true)
    expect(screen.getByText('Precio no válido o faltante')).toBeInTheDocument()
    expect(screen.getByText('Se aplicará 1 fila.')).toBeInTheDocument()
  })

  it('aplicar pide confirmación y solo entonces manda dryRun=false', async () => {
    const onChanged = vi.fn()
    vi.mocked(api.importProducts)
      .mockResolvedValueOnce({ dryRun: true, summary: { total: 1, created: 1, updated: 0, failed: 0 }, rows: [{ line: 2, name: 'Pan', status: 'CREATE' }] })
      .mockResolvedValueOnce({ dryRun: false, summary: { total: 1, created: 1, updated: 0, failed: 0 }, rows: [{ line: 2, name: 'Pan', status: 'CREATE' }] })
    render(<ImportTab inventory onChanged={onChanged} />)
    paste('nombre,precio\nPan,5')
    fireEvent.click(screen.getByRole('button', { name: 'Ver vista previa' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Aplicar importación' }))
    const dialog = await screen.findByRole('dialog', { name: '¿Aplicar la importación?' })
    expect(api.importProducts).toHaveBeenCalledTimes(1)
    fireEvent.click(within(dialog).getByRole('button', { name: 'Aplicar importación' }))
    await screen.findByText('Importación terminada')
    expect(api.importProducts).toHaveBeenLastCalledWith('b1', [{ line: 2, name: 'Pan', price: '5' }], false)
    expect(onChanged).toHaveBeenCalled()
  })

  it('cambiar el mapeo invalida la vista previa (no se puede aplicar lo que ya no se vio)', async () => {
    vi.mocked(api.importProducts).mockResolvedValue({ dryRun: true, summary: { total: 1, created: 1, updated: 0, failed: 0 }, rows: [{ line: 2, name: 'Pan', status: 'CREATE' }] })
    render(<ImportTab inventory onChanged={() => {}} />)
    paste('nombre,precio\nPan,5')
    fireEvent.click(screen.getByRole('button', { name: 'Ver vista previa' }))
    await screen.findByRole('button', { name: 'Aplicar importación' })
    fireEvent.change(screen.getAllByRole('combobox')[1], { target: { value: 'cost' } })
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Aplicar importación' })).not.toBeInTheDocument())
  })

  it('sin columna de nombre avisa y no deja ver la vista previa; sin inventario no ofrece columnas de existencia', () => {
    render(<ImportTab inventory={false} onChanged={() => {}} />)
    paste('precio,existencia\n5,3')
    expect(screen.getByText('Falta indicar cuál columna es el nombre del producto.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Ver vista previa' })).toBeDisabled()
    const options = within(screen.getAllByRole('combobox')[1]).getAllByRole('option').map((o) => o.textContent)
    expect(options).not.toContain('Existencia')
  })
})

describe('ProductsTab', () => {
  it('un costo que la API manda como null se muestra como "—", no como cero, y el filtro "Sin costo" lo encuentra', async () => {
    const withNull = product({ id: 'a', name: 'Queso', priceMinor: 9000, costMinor: null as unknown as undefined })
    const costed = product({ id: 'b', name: 'Leche', priceMinor: 5000, costMinor: 3200, trackStock: true, stockMilli: 14000 })
    vi.mocked(api.loadProducts).mockResolvedValue([withNull, costed])
    vi.mocked(api.loadCategories).mockResolvedValue([])
    render(<ProductsTab inventory reloadKey={0} onChanged={() => {}} />)
    const queso = (await screen.findByText('Queso')).closest('tr') as HTMLElement
    expect(within(queso).queryByText(/C\$\s?0\.00/)).not.toBeInTheDocument()
    expect(within(queso).getAllByText('—')).toHaveLength(2) // costo y margen
    expect(within(screen.getByText('Leche').closest('tr') as HTMLElement).getByText('36%')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('tab', { name: 'Sin costo' }))
    expect(screen.queryByText('Leche')).not.toBeInTheDocument()
    expect(screen.getByText('Queso')).toBeInTheDocument()
  })

  it('sin inventario es solo catálogo: no hay columna de existencia ni filtros de control', async () => {
    vi.mocked(api.loadProducts).mockResolvedValue([product({ id: 'a', name: 'Queso' })])
    vi.mocked(api.loadCategories).mockResolvedValue([])
    render(<ProductsTab inventory={false} reloadKey={0} onChanged={() => {}} />)
    await screen.findByText('Queso')
    expect(screen.queryByRole('columnheader', { name: 'Existencia' })).not.toBeInTheDocument()
    expect(screen.queryByRole('tab', { name: 'Con control' })).not.toBeInTheDocument()
  })

  it('un código de barras repetido se explica en lenguaje simple', async () => {
    const { ApiError } = await import('../../api/http')
    vi.mocked(api.loadProducts).mockResolvedValue([])
    vi.mocked(api.loadCategories).mockResolvedValue([])
    vi.mocked(api.saveProduct).mockRejectedValue(new ApiError(409, 'BARCODE_IN_USE', 'x'))
    render(<ProductsTab inventory reloadKey={0} onChanged={() => {}} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Nuevo producto' }))
    fireEvent.change(screen.getByLabelText(/^Nombre/), { target: { value: 'Pan' } })
    fireEvent.change(screen.getByLabelText(/^Precio de venta/), { target: { value: '5' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    expect(await screen.findByText('Ese código de barras ya lo usa otro producto.')).toBeInTheDocument()
  })
})

describe('PurchasesTab', () => {
  it('la compra nueva suma sus líneas, propone pagar todo y manda un cuerpo válido', async () => {
    vi.mocked(api.loadSuppliers).mockResolvedValue([])
    vi.mocked(api.loadPurchases).mockResolvedValue({ items: [], last: true })
    vi.mocked(api.loadProducts).mockResolvedValue([product({ id: 'p1', name: 'Leche', costMinor: 3200 })])
    vi.mocked(api.registerPurchase).mockResolvedValue({ id: 'x', totalMinor: 12800, paidMinor: 12800, balanceMinor: 0, voided: false, rev: 1 })
    render(<PurchasesTab supplierId="" onSupplier={() => {}} reloadKey={0} onChanged={() => {}} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Nueva compra' }))
    const dialog = await screen.findByRole('dialog', { name: 'Registrar compra' })
    await within(dialog).findByRole('option', { name: 'Leche' })
    fireEvent.change(within(dialog).getByLabelText('Producto'), { target: { value: 'p1' } })
    fireEvent.change(within(dialog).getByLabelText('Cantidad'), { target: { value: '4' } })
    expect((within(dialog).getByLabelText('Costo por unidad') as HTMLInputElement).value).toBe('32.00')
    expect(within(dialog).getAllByText(/128\.00/).length).toBeGreaterThan(0)
    expect((within(dialog).getByLabelText('Pagado ahora') as HTMLInputElement).value).toBe('128.00')
    fireEvent.change(within(dialog).getByLabelText('Pagado ahora'), { target: { value: '100' } })
    expect(within(dialog).getByText(/Quedan por pagar/)).toBeInTheDocument()
    fireEvent.click(within(dialog).getByRole('button', { name: /^Guardar compra/ }))
    await waitFor(() => expect(api.registerPurchase).toHaveBeenCalledTimes(1))
    const [business, , body] = vi.mocked(api.registerPurchase).mock.calls[0]
    expect(business).toBe('b1')
    expect(body).toMatchObject({ paidMinor: 10000, paidSource: 'CASH_DRAWER', lines: [{ productId: 'p1', quantityMilli: 4000, unitCostMinor: 3200 }] })
  })

  it('una compra sin líneas completas no se envía y marca el problema', async () => {
    vi.mocked(api.loadSuppliers).mockResolvedValue([])
    vi.mocked(api.loadPurchases).mockResolvedValue({ items: [], last: true })
    vi.mocked(api.loadProducts).mockResolvedValue([])
    render(<PurchasesTab supplierId="" onSupplier={() => {}} reloadKey={0} onChanged={() => {}} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Nueva compra' }))
    const dialog = await screen.findByRole('dialog', { name: 'Registrar compra' })
    fireEvent.click(within(dialog).getByRole('button', { name: /^Guardar compra/ }))
    expect(await within(dialog).findByText('Agrega al menos un producto a la compra.')).toBeInTheDocument()
    expect(api.registerPurchase).not.toHaveBeenCalled()
  })
})
