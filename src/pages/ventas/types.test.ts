import { describe, expect, it } from 'vitest'
import { canReturn, distinctMethods, lineCost, lineNets, mulDivHalfUp, parseQuantity, refundMethods, returnableMilli, returnEstimate, saleCost, saleInstant, saleTags, servedAndCharged } from './types'

describe('ventas: costo y ganancia de una venta', () => {
  it('el costo de una línea redondea la mitad hacia arriba, igual que el servidor', () => {
    expect(lineCost(6000, 2000)).toBe(12000)
    expect(lineCost(3333, 500)).toBe(1667) // 1666.5 → 1667
    expect(lineCost(1, 500)).toBe(1) // 0.5 → 1
    expect(lineCost(1, 499)).toBe(0)
  })

  it('las líneas sin costo no restan nada y bajan la cobertura', () => {
    const r = saleCost([
      { unitCostMinor: 6000, quantityMilli: 2000, lineTotalMinor: 20000 },
      { unitCostMinor: null, quantityMilli: 1000, lineTotalMinor: 4000 },
    ])
    expect(r.cost).toBe(12000)
    expect(r.costedRevenue).toBe(20000)
    expect(r.coveragePercent).toBe(83)
  })

  it('una venta sin líneas no divide por cero', () => {
    expect(saleCost([]).coveragePercent).toBe(100)
  })

  it('los métodos de pago se muestran sin repetir y en orden', () => {
    expect(distinctMethods([{ id: '1', method: 'CASH', amountMinor: 1 }, { id: '2', method: 'CREDIT', amountMinor: 1 }, { id: '3', method: 'CASH', amountMinor: 1 }])).toEqual(['CASH', 'CREDIT'])
    expect(distinctMethods(undefined)).toEqual([])
  })

  it('la fecha de una venta eliminada es la de su eliminación', () => {
    expect(saleInstant({ status: 'CANCELLED', completedAt: 'a', cancelledAt: 'b', createdAt: 'c' })).toBe('b')
    expect(saleInstant({ status: 'COMPLETED', completedAt: 'a', cancelledAt: undefined, createdAt: 'c' })).toBe('a')
    expect(saleInstant({ status: 'COMPLETED', completedAt: undefined, cancelledAt: undefined, createdAt: 'c' })).toBe('c')
  })
})

describe('ventas: devoluciones', () => {
  // Mismo caso que la prueba del servidor: 3 quesos a 100 y 1 crema a 50 = 350, descuento de la cuenta 35.
  const sale = {
    subtotalMinor: 35000, discountMinor: 3500, totalMinor: 31500, returnedMinor: 0, returns: [],
    items: [
      { id: 'q', quantityMilli: 3000, lineTotalMinor: 30000, returnedMilli: 0 },
      { id: 'c', quantityMilli: 1000, lineTotalMinor: 5000, returnedMilli: 0 },
    ],
  } as unknown as Parameters<typeof returnEstimate>[0]

  it('reparte el descuento de la cuenta y devuelve en proporción, redondeando igual que el servidor', () => {
    expect(lineNets(sale.items ?? [], 35000, 3500)).toEqual([27000, 4500])
    expect(returnEstimate(sale, { q: 1000 })).toBe(9000)
    expect(mulDivHalfUp(27000, 1, 3)).toBe(9000)
    expect(mulDivHalfUp(1, 1, 2)).toBe(1)
  })

  it('lo que queda de una línea se devuelve exacto, sin residuos', () => {
    const after = { ...sale, returnedMinor: 9000, items: [{ ...sale.items![0], returnedMilli: 1000 }, sale.items![1]], returns: [{ items: [{ saleItemId: 'q', quantityMilli: 1000, amountMinor: 9000 }] }] } as unknown as typeof sale
    expect(returnableMilli(after.items![0])).toBe(2000)
    expect(returnEstimate(after, { q: 2000 })).toBe(18000)
    expect(returnEstimate(after, { q: 9000 })).toBe(18000)
  })

  it('la nota de crédito solo aparece si la venta fue a fiado y se etiqueta lo que hay que revisar', () => {
    expect(refundMethods({ payments: [{ method: 'CASH' }] } as never)).toEqual(['CASH', 'SAME'])
    expect(refundMethods({ payments: [{ method: 'CREDIT' }] } as never)).toContain('CREDIT_NOTE')
    expect(saleTags({ conflictOfSaleId: 'x', reviewFlag: 'LATE_AFTER_DISABLE', returnedMinor: 100 })).toEqual(['CONFLICT', 'LATE_AFTER_DISABLE', 'RETURNED'])
    expect(saleTags({ reviewFlag: null, returnedMinor: 0 })).toEqual([])
    expect(canReturn({ status: 'CANCELLED', items: sale.items })).toBe(false)
    expect(parseQuantity('1,5')).toBe(1500)
    expect(parseQuantity('x')).toBe(0)
  })
})

describe('ventas: cobro en caja', () => {
  it('atendió y cobró solo cuando fueron personas distintas', () => {
    expect(servedAndCharged({ createdBy: { id: 'k', name: 'Kevin' }, completedBy: { id: 'a', name: 'Ana' } })).toEqual({ served: 'Kevin', charged: 'Ana' })
    expect(servedAndCharged({ createdBy: { id: 'a', name: 'Ana' }, completedBy: { id: 'a', name: 'Ana' } })).toBeNull()
    expect(servedAndCharged({ createdBy: { id: 'a', name: 'Ana' }, completedBy: undefined })).toBeNull()
  })
})
