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

/** Cobro en caja (ADR 0015): quién la tomó y quién la cobró, solo si fueron personas distintas («Atendió: Kevin · Cobró: Ana»). */
export function servedAndCharged(s: Pick<SaleRow, 'createdBy' | 'completedBy'>): { served: string; charged: string } | null {
  const served = s.createdBy?.name
  const charged = s.completedBy?.name
  if (!served || !charged || s.createdBy?.id === s.completedBy?.id) return null
  return { served, charged }
}

/** Letras mínimas del motivo para eliminar una venta cobrada (el servidor lo exige igual: REASON_REQUIRED). */
export const MIN_REASON = 5

// ---------- devoluciones ----------

export type SaleItem = NonNullable<SaleRow['items']>[number]
export type SaleReturn = NonNullable<SaleRow['returns']>[number]
export type RefundMethod = 'CASH' | 'SAME' | 'CREDIT_NOTE'

/** round-half-up(a × b / c) en enteros, igual que el servidor (sin decimales flotantes). */
export function mulDivHalfUp(a: number, b: number, c: number): number {
  if (c === 0) return 0
  const p = BigInt(a) * BigInt(b)
  const q = p / BigInt(c)
  const r = p % BigInt(c)
  return Number(r * 2n >= BigInt(c) ? q + 1n : q)
}

/** Neto de cada línea: su total menos la parte del descuento de la cuenta (repartido en proporción; el residuo va a la última). */
export function lineNets(items: Pick<SaleItem, 'lineTotalMinor'>[], subtotalMinor: number, discountMinor: number): number[] {
  let allocated = 0
  return items.map((i, idx) => {
    const share = idx === items.length - 1 ? discountMinor - allocated : subtotalMinor === 0 ? 0 : mulDivHalfUp(discountMinor, i.lineTotalMinor, subtotalMinor)
    allocated += share
    return Math.max(0, i.lineTotalMinor - share)
  })
}

/** Lo que aún se puede devolver de una línea (vendido − ya devuelto). */
export function returnableMilli(item: Pick<SaleItem, 'quantityMilli' | 'returnedMilli'>): number {
  return Math.max(0, item.quantityMilli - (item.returnedMilli ?? 0))
}

/** Monto ya devuelto por línea (de las devoluciones de la venta). */
function returnedAmounts(sale: Pick<SaleRow, 'returns'>): Map<string, number> {
  const out = new Map<string, number>()
  for (const r of sale.returns ?? []) for (const i of r.items ?? []) if (i.saleItemId) out.set(i.saleItemId, (out.get(i.saleItemId) ?? 0) + i.amountMinor)
  return out
}

/**
 * Cuánto se devolverá por las cantidades elegidas (la misma cuenta del servidor): devolver TODO lo que queda de una línea devuelve exactamente su neto
 * pendiente; una parte, en proporción.
 */
export function returnEstimate(sale: Pick<SaleRow, 'items' | 'subtotalMinor' | 'discountMinor' | 'returns' | 'totalMinor' | 'returnedMinor'>, milli: Record<string, number>): number {
  const items = sale.items ?? []
  const nets = lineNets(items, sale.subtotalMinor, sale.discountMinor)
  const done = returnedAmounts(sale)
  let total = 0
  items.forEach((item, idx) => {
    const q = milli[item.id] ?? 0
    if (q <= 0) return
    const remaining = returnableMilli(item)
    const qty = Math.min(q, remaining)
    total += Math.max(0, qty === remaining ? nets[idx] - (done.get(item.id) ?? 0) : mulDivHalfUp(nets[idx], qty, item.quantityMilli))
  })
  return Math.min(total, Math.max(0, sale.totalMinor - (sale.returnedMinor ?? 0)))
}

/** Cómo se puede devolver el dinero: la nota de crédito solo si la venta fue (en parte) a fiado. */
export function refundMethods(sale: Pick<SaleRow, 'payments'>): RefundMethod[] {
  return (sale.payments ?? []).some((p) => p.method === 'CREDIT') ? ['CASH', 'SAME', 'CREDIT_NOTE'] : ['CASH', 'SAME']
}

/** Se puede devolver algo: cobrada y con alguna línea pendiente. */
export function canReturn(sale: Pick<SaleRow, 'status' | 'items'>): boolean {
  return sale.status === 'COMPLETED' && (sale.items ?? []).some((i) => returnableMilli(i) > 0)
}

export type SaleTag = 'CONFLICT' | 'LATE_AFTER_DISABLE' | 'CLOCK_ADJUSTED' | 'RETURNED'

/** Etiquetas para revisar una venta en la lista y en el detalle. */
export function saleTags(sale: Pick<SaleRow, 'conflictOfSaleId' | 'reviewFlag' | 'returnedMinor'>): SaleTag[] {
  const out: SaleTag[] = []
  if (sale.conflictOfSaleId) out.push('CONFLICT')
  if (sale.reviewFlag === 'LATE_AFTER_DISABLE' || sale.reviewFlag === 'CLOCK_ADJUSTED') out.push(sale.reviewFlag)
  if ((sale.returnedMinor ?? 0) > 0) out.push('RETURNED')
  return out
}

/** Cantidad escrita (en unidades, con coma o punto) a milésimas; inválida → 0. */
export function parseQuantity(text: string): number {
  const v = Number(text.trim().replace(',', '.'))
  return Number.isFinite(v) && v > 0 ? Math.round(v * 1000) : 0
}
