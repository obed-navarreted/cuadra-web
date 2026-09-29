import { describe, expect, it } from 'vitest'
import { draftFromProduct, emptyDraft, marginPercent, needsReview, toProductInput } from './productDraft'
import type { Product } from './types'

const product: Product = {
  id: 'p1', name: 'Leche', priceMinor: 5000, costMinor: 3200, unit: 'L', pricing: 'FIXED', isQuick: true, quickPosition: 3, color: '#fff', trackStock: true, stockMilli: 14000,
  minStockMilli: 13000, active: true, rev: 1,
}

describe('valores nulos de la API', () => {
  // El servidor manda `"costMinor": null` y `"minStockMilli": null`; los tipos generados dicen solo `undefined`.
  const withNulls = { ...product, costMinor: null, minStockMilli: null, variant: null, barcode: null, categoryId: null } as unknown as Product

  it('un costo nulo no es cero: sin margen, y el formulario queda vacío', () => {
    expect(marginPercent(withNulls.priceMinor, withNulls.costMinor)).toBeNull()
    const d = draftFromProduct(withNulls, 2)
    expect(d.cost).toBe('')
    expect(d.minStock).toBe('')
    expect(d.variant).toBe('')
  })

  it('un mínimo nulo no manda a revisar', () => {
    expect(needsReview({ ...withNulls, stockMilli: 0 })).toBe(false)
  })
})

describe('formulario de producto', () => {
  it('un producto nuevo necesita nombre y precio', () => {
    expect(toProductInput(emptyDraft(), 'NIO', undefined, true).problems).toEqual(['name', 'price'])
    const ok = toProductInput({ ...emptyDraft(), name: 'Pan', price: '5' }, 'NIO', undefined, true)
    expect(ok.problems).toEqual([])
    expect(ok.input).toMatchObject({ name: 'Pan', priceMinor: 500, unit: 'UNIT', pricing: 'FIXED', trackStock: false, active: true })
    expect(ok.input?.costMinor).toBeUndefined()
  })

  it('interpreta montos y cantidades con coma y rechaza los inválidos', () => {
    const d = { ...emptyDraft(), name: 'X', price: '12,50', cost: '7.5', trackStock: true, minStock: '2,5' }
    expect(toProductInput(d, 'NIO', undefined, true).input).toMatchObject({ priceMinor: 1250, costMinor: 750, minStockMilli: 2500 })
    expect(toProductInput({ ...d, price: '1.999' }, 'NIO', undefined, true).problems).toEqual(['price'])
    expect(toProductInput({ ...d, cost: 'abc' }, 'NIO', undefined, true).problems).toEqual(['cost'])
    expect(toProductInput({ ...d, minStock: '1.2345' }, 'NIO', undefined, true).problems).toEqual(['minStock'])
  })

  it('al editar conserva lo que el formulario no toca', () => {
    const d = { ...draftFromProduct(product, 2), price: '55' }
    const { input } = toProductInput(d, 'NIO', product, true)
    expect(input).toMatchObject({ priceMinor: 5500, costMinor: 3200, quickPosition: 3, color: '#fff', active: true, minStockMilli: 13000, trackStock: true })
  })

  it('sin inventario no toca el control de existencia ni el mínimo', () => {
    const d = { ...draftFromProduct(product, 2), trackStock: false, minStock: '' }
    const { input } = toProductInput(d, 'NIO', product, false)
    expect(input).toMatchObject({ trackStock: true, minStockMilli: 13000 })
    expect(toProductInput({ ...emptyDraft(), name: 'Nuevo', price: '1', trackStock: true }, 'NIO', undefined, false).input?.trackStock).toBe(false)
  })

  it('el conteo inicial solo se valida al empezar a llevar control', () => {
    const d = { ...emptyDraft(), name: 'X', price: '1', trackStock: true, initialStock: '1.2345' }
    expect(toProductInput(d, 'NIO', undefined, true).problems).toEqual(['initialStock'])
    expect(toProductInput({ ...d, initialStock: '' }, 'NIO', undefined, true).problems).toEqual([])
  })

  it('margen y revisión', () => {
    expect(marginPercent(5000, 3200)).toBe(36)
    expect(marginPercent(5000, undefined)).toBeNull()
    expect(marginPercent(0, 10)).toBeNull()
    expect(needsReview(product)).toBe(false)
    expect(needsReview({ ...product, stockMilli: 13000 })).toBe(true)
    expect(needsReview({ ...product, stockMilli: -1 })).toBe(true)
    expect(needsReview({ ...product, trackStock: false, stockMilli: -5 })).toBe(false)
  })
})
