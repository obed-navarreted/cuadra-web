import { describe, expect, it } from 'vitest'
import { decimalsOf, formatMoney, parseMoney } from './money'

describe('dinero', () => {
  it('formatea con la moneda y el país del negocio, no con el idioma de quien mira', () => {
    expect(formatMoney(34250, 'NIO', 'NI', 'en')).toContain('342.50')
    expect(formatMoney(34250, 'NIO', 'NI', 'es')).toContain('342.50')
    expect(formatMoney(34250, 'NIO', 'NI', 'en')).toBe(formatMoney(34250, 'NIO', 'NI', 'es'))
  })

  it('separa el símbolo de la cifra igual que la app ("C$ 885.02")', () => {
    expect(formatMoney(88502, 'NIO', 'NI', 'es')).toBe('C$\u00a0885.02')
    expect(formatMoney(88502, 'NIO', 'NI', 'en')).toBe('C$\u00a0885.02')
  })

  it('las monedas sin centavos no muestran decimales', () => {
    expect(decimalsOf('CRC')).toBe(0)
    expect(decimalsOf('NIO')).toBe(2)
    expect(formatMoney(12500, 'CRC', 'CR', 'es')).not.toMatch(/[.,]\d{2}\D*$/)
  })

  it('un monto negativo (diferencia de cierre) conserva el signo', () => {
    expect(formatMoney(-1000, 'NIO', 'NI', 'es')).toMatch(/-|−/)
  })

  it('interpreta lo que escribe una persona', () => {
    expect(parseMoney('12.50', 'NIO')).toBe(1250)
    expect(parseMoney('12,5', 'NIO')).toBe(1250)
    expect(parseMoney('0', 'NIO')).toBe(0)
    expect(parseMoney('12.555', 'NIO')).toBeNull()
    expect(parseMoney('abc', 'NIO')).toBeNull()
    expect(parseMoney('', 'NIO')).toBeNull()
    expect(parseMoney('1250', 'CRC')).toBe(1250)
    expect(parseMoney('12.5', 'CRC')).toBeNull()
  })

  it('con separadores de miles decide por el último separador', () => {
    expect(parseMoney('1,000.00', 'NIO')).toBe(100000)
    expect(parseMoney('1.000,00', 'NIO')).toBe(100000)
    expect(parseMoney('1,234,567.89', 'NIO')).toBe(123456789)
    expect(parseMoney('1.000.000', 'CRC')).toBe(1000000)
    expect(parseMoney('1.000.00', 'NIO')).toBeNull()
    expect(parseMoney('10,00,000.00', 'NIO')).toBeNull()
  })
})
