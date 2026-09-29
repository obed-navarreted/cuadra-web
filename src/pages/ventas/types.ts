import type { components } from '../../api/schema'

type S = components['schemas']
export type SalePayment = S['PaymentView']
export type SaleRow = S['SaleView']
export type SalesReport = S['SalesReport']

export const METHODS = ['CASH', 'TRANSFER', 'CARD', 'CREDIT', 'OTHER'] as const
export type Method = (typeof METHODS)[number]

/** Costo de una línea: mismo redondeo (mitad hacia arriba) que el servidor. */
export function lineCost(unitCostMinor: number, quantityMilli: number): number {
  return Math.floor((unitCostMinor * quantityMilli + 500) / 1000)
}

/** Costo de lo vendido y cuánto de la venta tenía costo anotado (para no presentar como exacta una ganancia incompleta). */
export function saleCost(items: { unitCostMinor?: number | null; quantityMilli: number; lineTotalMinor: number }[]) {
  let cost = 0
  let costed = 0
  let total = 0
  for (const i of items) {
    total += i.lineTotalMinor
    if (i.unitCostMinor != null) {
      cost += lineCost(i.unitCostMinor, i.quantityMilli)
      costed += i.lineTotalMinor
    }
  }
  return { cost, costedRevenue: costed, coveragePercent: total === 0 ? 100 : Math.round((100 * costed) / total) }
}

/** Los métodos distintos con los que se pagó una venta, en el orden en que se cobraron. */
export function distinctMethods(payments: SalePayment[] | null | undefined): string[] {
  return [...new Set((payments ?? []).flatMap((p) => (p.method ? [p.method] : [])))]
}

/** La fecha que se muestra de una venta: cuándo se cobró, o cuándo se eliminó. */
export function saleInstant(s: Pick<SaleRow, 'status' | 'completedAt' | 'cancelledAt' | 'createdAt'>): string | undefined {
  return (s.status === 'CANCELLED' ? (s.cancelledAt ?? s.completedAt) : s.completedAt) ?? s.createdAt ?? undefined
}

/** Letras mínimas del motivo para eliminar una venta cobrada (el servidor lo exige igual: REASON_REQUIRED). */
export const MIN_REASON = 5
