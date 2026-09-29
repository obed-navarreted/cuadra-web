import { describe, expect, it } from 'vitest'
import { windowLocale, zoneFor, amountOf, cashParts, expectedCash, isEmptyDay, mergeMethods, totals, windowText, type DayClose } from './logic'

const day = (over: Partial<DayClose>): DayClose => ({
  salesCount: 0, salesMinor: 0, byMethod: [], creditCollected: [], drawerExpensesMinor: 0, otherExpensesMinor: 0, withdrawalsMinor: 0, depositsMinor: 0,
  expectedCashMinor: 0, cancelledCount: 0, cancelledMinor: 0, ...over,
})

describe('cierre del día', () => {
  it('la ventana muestra corte a corte en la zona del negocio', () => {
    // 02:00 en Managua (UTC-6) = 08:00 UTC
    const text = windowText('2026-09-28T08:00:00Z', '2026-09-29T08:00:00Z', 'America/Managua', 'es-NI')
    expect(text).toMatch(/^28 sept? 2:00\sa\.\sm\. → 29 sept? 2:00\sa\.\sm\.$/)
    const en = windowText('2026-09-28T08:00:00Z', '2026-09-29T08:00:00Z', 'America/Managua', 'en')
    expect(en).toMatch(/^28 Sep 2:00\s?AM → 29 Sep 2:00\s?AM$/)
  })

  it('en español usa el idioma del país del negocio', () => {
    expect(windowLocale('es', 'NI')).toBe('es-NI')
    expect(windowLocale('es', null)).toBe('es')
    expect(windowLocale('en', 'NI')).toBe('en')
  })

  it('la ventana respeta la zona, no la del navegador', () => {
    expect(windowText('2026-09-28T08:00:00Z', '2026-09-29T08:00:00Z', 'UTC', 'en')).toMatch(/^28 Sep 8:00\s?AM → 29 Sep 8:00\s?AM$/)
  })

  it('efectivo esperado = ventas y abonos en efectivo + entradas − gastos del cajón − retiros', () => {
    const d = day({
      byMethod: [{ method: 'CASH', amountMinor: 10000 }, { method: 'CARD', amountMinor: 4000 }],
      creditCollected: [{ method: 'CASH', amountMinor: 500 }, { method: 'TRANSFER', amountMinor: 900 }],
      depositsMinor: 1000, drawerExpensesMinor: 300, withdrawalsMinor: 2000,
    })
    expect(cashParts(d)).toEqual({ cashSales: 10000, cashCollected: 500, deposits: 1000, drawerExpenses: 300, withdrawals: 2000 })
    expect(expectedCash(d)).toBe(9200)
  })

  it('sin efectivo puede quedar negativo (más retiros que ventas)', () => {
    expect(expectedCash(day({ withdrawalsMinor: 500 }))).toBe(-500)
    expect(amountOf(undefined, 'CASH')).toBe(0)
  })

  it('une métodos sumando y en orden estable', () => {
    expect(mergeMethods([[{ method: 'CARD', amountMinor: 1 }, { method: 'CASH', amountMinor: 2 }], null, [{ method: 'CASH', amountMinor: 3 }, { method: 'ZZZ', amountMinor: 4 }]])).toEqual([
      { method: 'CASH', amountMinor: 5 }, { method: 'CARD', amountMinor: 1 }, { method: 'ZZZ', amountMinor: 4 },
    ])
  })

  it('totales de un rango suman cada día', () => {
    const t = totals([
      day({ salesCount: 2, salesMinor: 6000, byMethod: [{ method: 'CASH', amountMinor: 6000 }], expectedCashMinor: 5000, cancelledCount: 1, cancelledMinor: 700, drawerExpensesMinor: 1000 }),
      day({ salesCount: 1, salesMinor: 1500, byMethod: [{ method: 'CASH', amountMinor: 1000 }, { method: 'CARD', amountMinor: 500 }], expectedCashMinor: 1000, withdrawalsMinor: 200, depositsMinor: 50, otherExpensesMinor: 30 }),
    ])
    expect(t).toMatchObject({ days: 2, salesCount: 3, salesMinor: 7500, expectedCashMinor: 6000, cancelledCount: 1, cancelledMinor: 700, drawerExpensesMinor: 1000, withdrawalsMinor: 200, depositsMinor: 50, otherExpensesMinor: 30 })
    expect(t.byMethod).toEqual([{ method: 'CASH', amountMinor: 7000 }, { method: 'CARD', amountMinor: 500 }])
  })

  it('reconoce una jornada vacía', () => {
    expect(isEmptyDay(day({}))).toBe(true)
    expect(isEmptyDay(day({ salesCount: 1 }))).toBe(false)
    expect(isEmptyDay(day({ cancelledCount: 1 }))).toBe(false)
  })

  it('la zona de una jornada es la de la regla que regía ese día', () => {
    const rules = [{ from: '1970-01-01', timezone: 'America/Managua' }, { from: '2026-10-01', timezone: 'America/New_York' }]
    expect(zoneFor('2026-09-30', rules, 'X')).toBe('America/Managua')
    expect(zoneFor('2026-10-01', rules, 'X')).toBe('America/New_York')
    expect(zoneFor('2026-09-30', [], 'X')).toBe('X')
  })
})
