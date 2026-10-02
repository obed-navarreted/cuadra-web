import { fireEvent, render, screen, within } from '@testing-library/react'
import { act } from 'react'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { setLocale } from '../../i18n'
import * as api from './api'
import { PromotionsTab } from './PromotionsTab'
import type { Product, Promotion } from './types'

vi.mock('./api')
vi.mock('../../auth/context', () => ({
  useBusiness: () => ({
    membership: { businessId: 'b1', role: 'ADMIN' },
    business: { id: 'b1', currency: 'NIO', country: 'NI', timezone: 'America/Managua', dayCutoff: '02:00:00', modules: {} },
  }),
}))

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

const product = (over: Partial<Product>): Product => ({ id: 'p', name: 'X', priceMinor: 4500, unit: 'UNIT', pricing: 'FIXED', isQuick: false, trackStock: false, stockMilli: 0, active: true, rev: 1, updatedAt: '', ...over }) as Product
const promo = (over: Partial<Promotion>): Promotion =>
  ({ id: 'pr1', name: 'Cerveza 3 por C$ 100', productIds: ['t'], quantity: 3, priceMinor: 10000, active: true, deleted: false, state: 'ACTIVE', updatedAt: '', rev: 1, ...over }) as Promotion

const catalog = [product({ id: 't', name: 'Toña', barcode: '7501000000017' }), product({ id: 'v', name: 'Victoria', shortCode: 'VIC' }), product({ id: 'q', name: 'Queso', pricing: 'BY_WEIGHT' })]

describe('PromotionsTab', () => {
  it('lists promotions with their state and pauses one (the phones get it when they sync)', async () => {
    vi.mocked(api.loadPromotions).mockResolvedValue([promo({})])
    vi.mocked(api.loadProducts).mockResolvedValue(catalog)
    vi.mocked(api.setPromotionActive).mockResolvedValue(promo({ active: false, state: 'PAUSED' }))
    render(<PromotionsTab reloadKey={0} />)
    expect(await screen.findByText('Cerveza 3 por C$ 100')).toBeInTheDocument()
    expect(screen.getByText('Activa')).toBeInTheDocument()
    expect(await screen.findByText('Toña')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Pausar' }))
    await vi.waitFor(() => expect(api.setPromotionActive).toHaveBeenCalledWith('b1', 'pr1', false))
  })

  it('creates one choosing products by search and by code, with the example from the register rule', async () => {
    vi.mocked(api.loadPromotions).mockResolvedValue([])
    vi.mocked(api.loadProducts).mockResolvedValue(catalog)
    vi.mocked(api.savePromotion).mockResolvedValue(promo({}))
    render(<PromotionsTab reloadKey={0} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Nueva promoción' }))
    const dialog = await screen.findByRole('dialog', { name: 'Nueva promoción' })
    const d = within(dialog)
    fireEvent.change(d.getByLabelText(/^Nombre/), { target: { value: 'Cerveza 3 por C$ 100' } })
    fireEvent.change(d.getByLabelText('Precio por esa cantidad'), { target: { value: '100' } })
    // Buscar y tocar.
    fireEvent.change(d.getByLabelText('Buscar por nombre o código'), { target: { value: 'toñ' } })
    fireEvent.click(d.getByRole('button', { name: /Toña/ }))
    expect(d.getByText('Toña agregado')).toBeInTheDocument()
    // Un lector de códigos: código y Enter. El código corto también sirve; repetir avisa.
    const code = d.getByLabelText('Código de barras o corto')
    fireEvent.change(code, { target: { value: 'VIC' } })
    fireEvent.keyDown(code, { key: 'Enter' })
    expect(d.getByText('Victoria agregado')).toBeInTheDocument()
    fireEvent.change(code, { target: { value: '7501000000017' } })
    fireEvent.keyDown(code, { key: 'Enter' })
    expect(d.getByText('Toña ya está en la lista')).toBeInTheDocument()
    fireEvent.change(code, { target: { value: '000' } })
    fireEvent.keyDown(code, { key: 'Enter' })
    expect(d.getByText('El código 000 no está en el catálogo')).toBeInTheDocument()
    expect(d.getByText(/Ejemplo: 7 × C\$\s45\.00 = C\$\s245\.00/)).toBeInTheDocument()
    // Quitar uno.
    fireEvent.click(d.getByRole('button', { name: 'Quitar Victoria' }))
    fireEvent.click(d.getByRole('button', { name: 'Guardar' }))
    await vi.waitFor(() => expect(api.savePromotion).toHaveBeenCalled())
    const [, , body] = vi.mocked(api.savePromotion).mock.calls[0]
    expect(body).toEqual({ name: 'Cerveza 3 por C$ 100', quantity: 3, priceMinor: 10000, productIds: ['t'], active: true, startsOn: undefined, endsOn: undefined })
  })

  it('does not save without products and explains it', async () => {
    vi.mocked(api.loadPromotions).mockResolvedValue([])
    vi.mocked(api.loadProducts).mockResolvedValue(catalog)
    render(<PromotionsTab reloadKey={0} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Nueva promoción' }))
    const d = within(await screen.findByRole('dialog', { name: 'Nueva promoción' }))
    fireEvent.change(d.getByLabelText(/^Nombre/), { target: { value: 'Algo' } })
    fireEvent.change(d.getByLabelText('Precio por esa cantidad'), { target: { value: '10' } })
    fireEvent.click(d.getByRole('button', { name: 'Guardar' }))
    expect(d.getAllByText('Agrega al menos un producto.').length).toBeGreaterThan(0)
    expect(api.savePromotion).not.toHaveBeenCalled()
  })
})
