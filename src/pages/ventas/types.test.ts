import { describe, expect, it } from 'vitest'
import { distinctMethods, lineCost, saleCost, saleInstant } from './types'

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
