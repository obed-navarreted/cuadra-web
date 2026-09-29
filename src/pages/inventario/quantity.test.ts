import { describe, expect, it } from 'vitest'
import { lineTotal, moneyInput, parseQuantity, quantityInput } from './quantity'

describe('cantidades', () => {
  it('interpreta hasta tres decimales', () => {
    expect(parseQuantity('12')).toBe(12000)
    expect(parseQuantity('0,75')).toBe(750)
    expect(parseQuantity('2.500')).toBe(2500)
    expect(parseQuantity('0.001')).toBe(1)
    expect(parseQuantity('1.2345')).toBeNull()
    expect(parseQuantity('-1')).toBeNull()
    expect(parseQuantity('')).toBeNull()
    expect(parseQuantity('abc')).toBeNull()
  })

  it('ida y vuelta', () => {
    expect(quantityInput(12500)).toBe('12.5')
    expect(parseQuantity(quantityInput(12500))).toBe(12500)
    expect(moneyInput(1250, 2)).toBe('12.50')
    expect(moneyInput(1250, 0)).toBe('1250')
  })

  it('el total de una línea redondea como el servidor (mitad hacia arriba)', () => {
    expect(lineTotal(2500, 10000)).toBe(25000)
    expect(lineTotal(1000, 500)).toBe(500)
    expect(lineTotal(1, 500)).toBe(1) // 0.5 → 1
    expect(lineTotal(1, 499)).toBe(0)
    expect(lineTotal(333, 1500)).toBe(500) // 499.5 → 500
  })
})
