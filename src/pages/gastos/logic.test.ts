import { describe, expect, it } from 'vitest'
import { bars, categoryLabel, checkDraft, occurredAtFor, splitVoided, type ExpenseDraft } from './logic'

const draft = (over: Partial<ExpenseDraft> = {}): ExpenseDraft => ({ amount: '12.50', description: '', categoryId: '', source: 'BANK', date: '2026-09-29', ...over })

describe('gastos', () => {
  it('valida monto, fecha y descripción antes de ir al servidor', () => {
    expect(checkDraft(draft(), 'NIO', '2026-09-29')).toEqual({ ok: true, amountMinor: 1250 })
    expect(checkDraft(draft({ amount: '12,5' }), 'NIO', '2026-09-29')).toEqual({ ok: true, amountMinor: 1250 })
    expect(checkDraft(draft({ amount: '0' }), 'NIO', '2026-09-29')).toEqual({ ok: false, error: 'amount' })
    expect(checkDraft(draft({ amount: 'abc' }), 'NIO', '2026-09-29')).toEqual({ ok: false, error: 'amount' })
    expect(checkDraft(draft({ amount: '12.555' }), 'NIO', '2026-09-29')).toEqual({ ok: false, error: 'amount' })
    expect(checkDraft(draft({ date: '2026-09-30' }), 'NIO', '2026-09-29')).toEqual({ ok: false, error: 'date' })
    expect(checkDraft(draft({ date: '' }), 'NIO', '2026-09-29')).toEqual({ ok: false, error: 'date' })
    expect(checkDraft(draft({ description: 'x'.repeat(201) }), 'NIO', '2026-09-29')).toEqual({ ok: false, error: 'description' })
  })

  it('un gasto de hoy no manda hora; uno pasado va al mediodía local de ese día', () => {
    expect(occurredAtFor('2026-09-29', '2026-09-29', 'America/Managua')).toBeUndefined()
    // Mediodía en Managua (UTC−6) = 18:00Z.
    expect(occurredAtFor('2026-09-20', '2026-09-29', 'America/Managua')).toBe('2026-09-20T18:00:00.000Z')
    // En Nueva York en verano (UTC−4) y en invierno (UTC−5) el mediodía local cambia de hora UTC.
    expect(occurredAtFor('2026-07-01', '2026-09-29', 'America/New_York')).toBe('2026-07-01T16:00:00.000Z')
    expect(occurredAtFor('2026-12-01', '2027-01-15', 'America/New_York')).toBe('2026-12-01T17:00:00.000Z')
  })

  it('las categorías de fábrica se traducen por su clave y las renombradas usan su nombre', () => {
    const t = (k: string) => (k === 'goods' ? 'Mercadería' : null)
    expect(categoryLabel({ key: 'goods', name: null }, t)).toBe('Mercadería')
    expect(categoryLabel({ key: 'goods', name: 'Compras' }, t)).toBe('Compras')
    expect(categoryLabel({ key: null, name: 'Publicidad' }, t)).toBe('Publicidad')
    expect(categoryLabel({ key: 'desconocida', name: null }, t)).toBe('desconocida')
  })

  it('las barras son proporcionales al mayor', () => {
    expect(bars([{ amountMinor: 200 }, { amountMinor: 100 }, { amountMinor: 0 }]).map((b) => b.percent)).toEqual([100, 50, 0])
    expect(bars([])).toEqual([])
  })

  it('separa anulados de vigentes', () => {
    const r = splitVoided([{ voided: false, id: 1 }, { voided: true, id: 2 }, { voided: false, id: 3 }])
    expect(r.active.map((x) => x.id)).toEqual([1, 3])
    expect(r.voided.map((x) => x.id)).toEqual([2])
  })
})
