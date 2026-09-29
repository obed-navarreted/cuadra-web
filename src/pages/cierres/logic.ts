import type { components } from '../../api/schema'

export type Shift = components['schemas']['ShiftView']

export type Outcome = 'balanced' | 'short' | 'over'

/** Cuadró, faltó o sobró: negativo = falta dinero, positivo = sobra. */
export function outcome(differenceMinor: number): Outcome {
  return differenceMinor === 0 ? 'balanced' : differenceMinor < 0 ? 'short' : 'over'
}

export function summarize(shifts: Shift[]) {
  const closed = shifts.filter((s) => s.status === 'CLOSED')
  return {
    closed: closed.length,
    open: shifts.length - closed.length,
    net: closed.reduce((n, s) => n + (s.differenceMinor ?? 0), 0),
    absolute: closed.reduce((n, s) => n + Math.abs(s.differenceMinor ?? 0), 0),
    forced: closed.filter((s) => s.forcedReason).length,
  }
}
