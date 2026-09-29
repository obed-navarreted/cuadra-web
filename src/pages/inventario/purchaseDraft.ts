import { parseMoney } from '../../lib/money'
import { lineTotal, parseQuantity } from './quantity'
import type { PurchaseInput } from './types'

export type LineDraft = { key: string; productId: string; name: string; quantity: string; cost: string }

/** Compra en armado. `paid === null` significa "pagar todo" (lo habitual); un texto vacío, "no se pagó nada". */
export type PurchaseDraft = { supplierId: string; supplierName: string; lines: LineDraft[]; paid: string | null; paidSource: string; note: string }

export function emptyLine(key: string): LineDraft {
  return { key, productId: '', name: '', quantity: '', cost: '' }
}

export function emptyPurchase(firstKey: string): PurchaseDraft {
  return { supplierId: '', supplierName: '', lines: [emptyLine(firstKey)], paid: null, paidSource: 'CASH_DRAWER', note: '' }
}

/** El total de las líneas válidas (las incompletas todavía no suman). */
export function draftTotal(d: PurchaseDraft, currency: string): number {
  return d.lines.reduce((sum, l) => {
    const q = parseQuantity(l.quantity)
    const c = parseMoney(l.cost, currency)
    return q !== null && q > 0 && c !== null ? sum + lineTotal(c, q) : sum
  }, 0)
}

export type PurchaseProblem = 'lines' | 'paid' | `line:${string}`

/** El cuerpo de `PUT /purchases/{id}` (con un id nuevo por línea y por compra que pone quien llama) o los problemas a marcar. */
export function toPurchaseInput(d: PurchaseDraft, currency: string, purchaseUuid: (line: LineDraft) => string): { input?: PurchaseInput; total: number; problems: PurchaseProblem[] } {
  const problems: PurchaseProblem[] = []
  const lines = d.lines.filter((l) => l.productId || l.name.trim() || l.quantity.trim() || l.cost.trim())
  if (lines.length === 0) problems.push('lines')
  const out: NonNullable<PurchaseInput['lines']> = []
  for (const l of lines) {
    const q = parseQuantity(l.quantity)
    const c = parseMoney(l.cost, currency)
    if (q === null || q <= 0 || c === null || (!l.productId && !l.name.trim())) {
      problems.push(`line:${l.key}`)
      continue
    }
    out.push({ id: purchaseUuid(l), productId: l.productId || undefined, name: l.name.trim() || undefined, quantityMilli: q, unitCostMinor: c })
  }
  const total = draftTotal({ ...d, lines }, currency)
  let paid = total
  if (d.paid !== null) {
    const p = d.paid.trim() === '' ? 0 : parseMoney(d.paid, currency)
    if (p === null || p > total) problems.push('paid')
    else paid = p
  }
  if (problems.length > 0) return { problems, total }
  return {
    problems,
    total,
    input: {
      supplierId: d.supplierId || undefined,
      supplierName: d.supplierId ? undefined : d.supplierName.trim() || undefined,
      lines: out,
      paidMinor: paid > 0 ? paid : undefined,
      paidSource: paid > 0 ? d.paidSource : undefined,
      note: d.note.trim() || undefined,
    },
  }
}
