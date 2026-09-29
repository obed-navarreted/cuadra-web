import { parseMoney } from '../../lib/money'
import { moneyInput, parseQuantity, quantityInput } from './quantity'
import type { Product, ProductInput } from './types'

export type Pricing = 'FIXED' | 'BY_WEIGHT' | 'OPEN'

/** Lo que se escribe en el formulario de producto (todo texto: se valida al guardar). */
export type ProductDraft = {
  name: string
  variant: string
  barcode: string
  shortCode: string
  categoryId: string
  unit: string
  pricing: Pricing
  price: string
  cost: string
  isQuick: boolean
  trackStock: boolean
  minStock: string
  /** Solo al empezar a llevar control: el conteo inicial (opcional). */
  initialStock: string
}

export type Problem = 'name' | 'barcode' | 'shortCode' | 'price' | 'cost' | 'minStock' | 'initialStock'

export function emptyDraft(): ProductDraft {
  return { name: '', variant: '', barcode: '', shortCode: '', categoryId: '', unit: 'UNIT', pricing: 'FIXED', price: '', cost: '', isQuick: false, trackStock: false, minStock: '', initialStock: '' }
}

export function draftFromProduct(p: Product, decimals: number): ProductDraft {
  return {
    name: p.name ?? '',
    variant: p.variant ?? '',
    barcode: p.barcode ?? '',
    shortCode: p.shortCode ?? '',
    categoryId: p.categoryId ?? '',
    unit: p.unit ?? 'UNIT',
    pricing: p.pricing === 'BY_WEIGHT' || p.pricing === 'OPEN' ? p.pricing : 'FIXED',
    // Con precio abierto, 0 significa "sin sugerencia": el campo queda vacío.
    price: p.pricing === 'OPEN' && !p.priceMinor ? '' : moneyInput(p.priceMinor, decimals),
    cost: moneyInput(p.costMinor, decimals),
    isQuick: p.isQuick,
    trackStock: p.trackStock,
    minStock: quantityInput(p.minStockMilli),
    initialStock: '',
  }
}

/**
 * El cuerpo de `PUT /products/{id}` o los problemas del formulario. Al editar se conservan los campos que esta pantalla no toca (color, posición
 * de "rápido", activo): mandar el producto incompleto los borraría. Si el negocio no lleva inventario (`inventory === false`) no se toca el control de existencia.
 */
export function toProductInput(d: ProductDraft, currency: string, base: Product | undefined, inventory: boolean): { input?: ProductInput; problems: Problem[] } {
  const problems: Problem[] = []
  const name = d.name.trim()
  if (!name || name.length > 200) problems.push('name')
  const barcode = d.barcode.trim()
  const shortCode = d.shortCode.trim()
  if (barcode.length > 64) problems.push('barcode')
  if (shortCode.length > 16) problems.push('shortCode')
  // Precio abierto: el precio es opcional (solo una sugerencia); con precio fijo o por peso es obligatorio.
  const open = d.pricing === 'OPEN'
  const priceBlank = d.price.trim() === ''
  const price = open && priceBlank ? null : parseMoney(d.price, currency)
  if (price === null && !(open && priceBlank)) problems.push('price')
  const cost = d.cost.trim() === '' ? null : parseMoney(d.cost, currency)
  if (d.cost.trim() !== '' && cost === null) problems.push('cost')
  const track = inventory ? d.trackStock : (base?.trackStock ?? false)
  const min = inventory && track && d.minStock.trim() !== '' ? parseQuantity(d.minStock) : null
  if (inventory && track && d.minStock.trim() !== '' && min === null) problems.push('minStock')
  if (inventory && track && !base?.trackStock && d.initialStock.trim() !== '' && parseQuantity(d.initialStock) === null) problems.push('initialStock')
  if (problems.length > 0) return { problems }
  const blank = (s: string) => (s.trim() === '' ? null : s.trim())
  return {
    problems,
    input: {
      name,
      variant: blank(d.variant),
      barcode: barcode || null,
      shortCode: shortCode || null,
      categoryId: blank(d.categoryId),
      unit: d.unit,
      pricing: d.pricing,
      priceMinor: price ?? undefined,
      costMinor: cost,
      isQuick: d.isQuick,
      quickPosition: base?.quickPosition,
      color: base?.color,
      trackStock: track,
      minStockMilli: min ?? (inventory && track ? undefined : base?.minStockMilli),
      active: base?.active ?? true,
    },
  }
}

/** Margen en % sobre el precio (redondeado), o `null` si falta el costo o el precio es cero. */
export function marginPercent(priceMinor: number, costMinor: number | null | undefined): number | null {
  if (costMinor == null || priceMinor <= 0) return null
  return Math.round(((priceMinor - costMinor) * 100) / priceMinor)
}

/** Un producto que lleva control está "por revisar" si su existencia es negativa o llegó a su mínimo. */
export function needsReview(p: Product): boolean {
  return p.trackStock && (p.stockMilli < 0 || (p.minStockMilli != null && p.stockMilli <= p.minStockMilli))
}
