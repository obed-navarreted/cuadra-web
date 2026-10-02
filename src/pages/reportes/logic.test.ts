import { describe, expect, it } from 'vitest'
import { plainAmount, axisLabel, barPercent, closingKind, coverageIncomplete, labelEvery, niceScale, share, showServedToggle, toCsv, topPeople } from './logic'

describe('porcentajes', () => {
  it('share redondea y protege contra total cero', () => {
    expect(share(30000, 53000)).toBe(57)
    expect(share(1, 3)).toBe(33)
    expect(share(5, 0)).toBe(0)
  })
  it('barPercent nunca sale del 0–100', () => {
    expect(barPercent(50, 200)).toBe(25)
    expect(barPercent(-5, 200)).toBe(0)
    expect(barPercent(500, 200)).toBe(100)
    expect(barPercent(5, 0)).toBe(0)
  })
})

describe('escala del gráfico', () => {
  it('el máximo es redondo y cubre el mayor valor', () => {
    for (const v of [1, 9, 940000, 1284000, 5800, 100000, 7]) {
      const s = niceScale(v)
      expect(s.max).toBeGreaterThanOrEqual(v)
      expect(s.ticks).toHaveLength(5)
      expect(s.ticks[4]).toBe(s.max)
      expect(s.ticks[0]).toBe(0)
    }
    expect(niceScale(940000).max).toBe(1000000)
    expect(niceScale(100000).max).toBe(100000)
  })
  it('todo en cero no divide entre cero', () => {
    const s = niceScale(0)
    expect(s.max).toBeGreaterThan(0)
  })
  it('las marcas usan notación compacta en unidades mayores', () => {
    expect(axisLabel(1000000, 2, 'en')).toBe('10K')
    expect(axisLabel(0, 2, 'es')).toBe('0')
    expect(axisLabel(2500, 0, 'en')).toBe('2.5K')
  })
  it('las etiquetas del eje se espacian según el ancho por día', () => {
    expect(labelEvery(7, 60)).toBe(1)
    expect(labelEvery(30, 12)).toBe(3)
    expect(labelEvery(90, 8)).toBeGreaterThan(labelEvery(30, 8))
  })
})

describe('cierres y costo', () => {
  it('clasifica la diferencia', () => {
    expect(closingKind(0)).toBe('balanced')
    expect(closingKind(-1000)).toBe('short')
    expect(closingKind(250)).toBe('over')
  })
  it('avisa cuando el costo no cubre todo', () => {
    expect(coverageIncomplete(93)).toBe(true)
    expect(coverageIncomplete(100)).toBe(false)
  })
})

describe('csv', () => {
  it('pone BOM, comillas y separa con CRLF', () => {
    expect(toCsv(['a', 'b'], [['x,y', 'say "hi"']])).toBe('﻿a,b\r\n"x,y","say ""hi"""\r\n')
  })
  it('neutraliza fórmulas pero deja pasar números negativos', () => {
    const csv = toCsv(['c'], [['=HYPERLINK(1)'], ['-1000'], ['-12.50'], ['+cmd']])
    expect(csv).toContain("'=HYPERLINK(1)")
    expect(csv).toContain('\r\n-1000\r\n')
    expect(csv).toContain('\r\n-12.50\r\n')
    expect(csv).toContain("'+cmd")
  })
})

describe('monto para CSV', () => {
  it('usa los decimales de la moneda, sin símbolo ni miles', () => {
    expect(plainAmount(1284050, 'NIO')).toBe('12840.50')
    expect(plainAmount(-1000, 'NIO')).toBe('-10.00')
    expect(plainAmount(12500, 'CRC')).toBe('12500')
  })
})

describe('por persona: Cobró / Atendió y las primeras cinco', () => {
  const a = [{ key: 'l', count: 1, totalMinor: 450 }]
  const b = [{ key: 'k', count: 1, totalMinor: 450 }]
  it('el control aparece con «Cobro en caja» o si los dos repartos difieren', () => {
    expect(showServedToggle(true, a, a)).toBe(true)
    expect(showServedToggle(false, a, b)).toBe(true)
    expect(showServedToggle(false, a, a)).toBe(false)
    expect(showServedToggle(false, undefined, a)).toBe(false)
    expect(showServedToggle(false, [{ key: 'x', count: 1, totalMinor: 1 }, { key: 'y', count: 2, totalMinor: 2 }], [{ key: 'y', count: 2, totalMinor: 2 }, { key: 'x', count: 1, totalMinor: 1 }])).toBe(false)
  })
  it('muestra 5 (o todas con 6 o menos) y «Ver todos» muestra el resto', () => {
    const n = (k: number) => Array.from({ length: k }, (_, i) => ({ totalMinor: (i + 1) * 100 }))
    expect(topPeople(n(1), false)).toEqual({ shown: [{ totalMinor: 100 }], hidden: 0 })
    expect(topPeople(n(6), false).shown).toHaveLength(6)
    const twelve = topPeople(n(12), false)
    expect(twelve.shown.map((r) => r.totalMinor)).toEqual([1200, 1100, 1000, 900, 800])
    expect(twelve.hidden).toBe(7)
    expect(topPeople(n(12), true)).toMatchObject({ hidden: 0 })
    expect(topPeople(n(12), true).shown).toHaveLength(12)
  })
})
