import { describe, expect, it } from 'vitest'
import { addProduct, byCode, draftFromPromotion, emptyPromotion, example, toPromotionInput } from './promotionDraft'
import type { Product, Promotion } from './types'

const product = (id: string, over: Partial<Product> = {}): Product =>
  ({ id, name: id, unit: 'UNIT', pricing: 'FIXED', priceMinor: 4500, isQuick: false, trackStock: false, stockMilli: 0, active: true, updatedAt: '', rev: 1, ...over }) as Product

describe('promotion editor', () => {
  it('builds the input with minor units and unique products', () => {
    const { input, problems } = toPromotionInput({ ...emptyPromotion(), name: ' Cerveza 3 por C$ 100 ', price: '100', productIds: ['a', 'b', 'a'] }, 'NIO')
    expect(problems).toEqual([])
    expect(input).toEqual({ name: 'Cerveza 3 por C$ 100', quantity: 3, priceMinor: 10000, productIds: ['a', 'b'], active: true, startsOn: undefined, endsOn: undefined })
  })

  it('reports every problem', () => {
    const { input, problems } = toPromotionInput({ name: '', quantity: '1', price: 'x', active: true, startsOn: '2026-10-09', endsOn: '2026-10-01', productIds: [] }, 'NIO')
    expect(input).toBeNull()
    expect(problems).toEqual(['name', 'quantity', 'price', 'products', 'dates'])
  })

  it('round-trips an existing promotion', () => {
    const p = { id: 'p', name: 'X', productIds: ['a'], quantity: 3, priceMinor: 10000, active: false, startsOn: '2026-10-01', endsOn: null, deleted: false, state: 'PAUSED', updatedAt: '', rev: 1 } as Promotion
    expect(draftFromPromotion(p, 2)).toEqual({ name: 'X', quantity: '3', price: '100.00', active: false, startsOn: '2026-10-01', endsOn: '', productIds: ['a'] })
  })

  it('computes the example with the register rule: 7 × 45 with 3 for 100 = 245', () => {
    expect(example({ ...emptyPromotion(), price: '100' }, 'NIO', [4000, 4500])).toEqual({ units: 7, unitMinor: 4500, totalMinor: 24500, noBenefit: false })
    expect(example({ ...emptyPromotion(), price: '200' }, 'NIO', [4500])?.noBenefit).toBe(true)
    expect(example({ ...emptyPromotion(), price: '' }, 'NIO', [4500])).toBeNull()
  })

  it('adds once, refuses weighed and open-price products and finds by barcode or short code', () => {
    const toña = product('t', { barcode: '012345678905', shortCode: 'T1' })
    const first = addProduct([], toña)
    expect(first.outcome).toBe('added')
    expect(addProduct(first.ids, toña).outcome).toBe('already')
    expect(addProduct([], product('q', { pricing: 'BY_WEIGHT' })).outcome).toBe('notEligible')
    expect(addProduct([], product('s', { pricing: 'OPEN' })).outcome).toBe('notEligible')
    expect(byCode([toña], '0012345678905')?.id).toBe('t')
    expect(byCode([toña], 'T1')?.id).toBe('t')
    expect(byCode([toña], '999')).toBeUndefined()
  })
})
