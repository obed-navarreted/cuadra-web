import { describe, expect, it } from 'vitest'
import { outcome, summarize, type Shift } from './logic'

const shift = (over: Partial<Shift>): Shift => ({ id: 'x', lateOps: 0, openingFloatMinor: 0, reopenedCount: 0, rev: 1, ...over }) as Shift

describe('cierres', () => {
  it('cuadró, falta o sobra según el signo de la diferencia', () => {
    expect(outcome(0)).toBe('balanced')
    expect(outcome(-1000)).toBe('short')
    expect(outcome(250)).toBe('over')
  })

  it('suma diferencias netas y absolutas sin compensar y cuenta los forzados', () => {
    const r = summarize([
      shift({ status: 'CLOSED', differenceMinor: -1000 }),
      shift({ status: 'CLOSED', differenceMinor: 400, forcedReason: 'teléfono perdido' }),
      shift({ status: 'OPEN' }),
    ])
    expect(r).toEqual({ closed: 2, open: 1, net: -600, absolute: 1400, forced: 1 })
  })
})
