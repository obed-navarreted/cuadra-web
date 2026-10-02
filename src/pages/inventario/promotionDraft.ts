import { parseMoney } from '../../lib/money'
import type { Product, Promotion, PromotionInput } from './types'

/** Lo que se escribe en el editor de una promoción («Cerveza 3 por C$ 100»). Las fechas son jornadas del negocio (`yyyy-mm-dd`, opcionales). */
export type PromotionDraft = { name: string; quantity: string; price: string; active: boolean; startsOn: string; endsOn: string; productIds: string[] }

export type PromotionProblem = 'name' | 'quantity' | 'price' | 'products' | 'dates'

export const emptyPromotion = (): PromotionDraft => ({ name: '', quantity: '3', price: '', active: true, startsOn: '', endsOn: '', productIds: [] })

export function draftFromPromotion(p: Promotion, decimals: number): PromotionDraft {
  return {
    name: p.name ?? '',
    quantity: String(p.quantity),
    price: (p.priceMinor / 10 ** decimals).toFixed(decimals),
    active: p.active,
    startsOn: p.startsOn ?? '',
    endsOn: p.endsOn ?? '',
    productIds: [...(p.productIds ?? [])],
  }
}

/** Las mismas reglas que la app y el servidor: nombre, de 2 a 999 unidades, un precio, al menos un producto y fechas en orden. */
export function toPromotionInput(d: PromotionDraft, currency: string): { input: PromotionInput | null; problems: PromotionProblem[] } {
  const problems: PromotionProblem[] = []
  const name = d.name.trim()
  if (!name || name.length > 80) problems.push('name')
  const quantity = /^\d{1,3}$/.test(d.quantity.trim()) ? Number(d.quantity.trim()) : NaN
  if (!(quantity >= 2 && quantity <= 999)) problems.push('quantity')
  const price = parseMoney(d.price, currency)
  if (price === null || price <= 0) problems.push('price')
  if (d.productIds.length === 0) problems.push('products')
  if (d.startsOn && d.endsOn && d.endsOn < d.startsOn) problems.push('dates')
  if (problems.length > 0) return { input: null, problems }
  return {
    input: { name, quantity, priceMinor: price!, productIds: [...new Set(d.productIds)], active: d.active, startsOn: d.startsOn || undefined, endsOn: d.endsOn || undefined },
    problems,
  }
}

/** Solo los productos de precio fijo entran en una promoción (por peso y de precio abierto no tienen «unidades» iguales). */
export const eligible = (p: Product) => p.pricing === 'FIXED' && p.active

/** Agregar un producto a la lista: si ya está o no es apto se dice por qué (nada cambia). */
export function addProduct(ids: string[], p: Product): { ids: string[]; outcome: 'added' | 'already' | 'notEligible' } {
  if (!eligible(p)) return { ids, outcome: 'notEligible' }
  if (ids.includes(p.id)) return { ids, outcome: 'already' }
  return { ids: [...ids, p.id], outcome: 'added' }
}

/** El producto de un código leído o tecleado (código de barras, con su forma UPC/EAN equivalente, o código corto). */
export function byCode(products: Product[], raw: string): Product | undefined {
  const code = raw.trim()
  if (!code) return undefined
  const forms = new Set([code])
  if (/^\d{12}$/.test(code)) forms.add(`0${code}`)
  if (/^0\d{12}$/.test(code)) forms.add(code.slice(1))
  return products.find((p) => (p.barcode && forms.has(p.barcode)) || p.shortCode === code)
}

/**
 * «Ejemplo: 7 × C$ 45 = C$ 245»: 2N + 1 unidades del producto más caro de la lista, con la misma regla que la caja (paquetes con las unidades más caras,
 * solo si le conviene al cliente). `null` si falta la cantidad, el precio o los productos.
 */
export function example(d: PromotionDraft, currency: string, unitPrices: number[]): { units: number; unitMinor: number; totalMinor: number; noBenefit: boolean } | null {
  const quantity = Number(d.quantity)
  const price = parseMoney(d.price, currency)
  const unit = Math.max(0, ...unitPrices)
  if (!(quantity >= 2 && quantity <= 999) || price === null || price <= 0 || unit <= 0) return null
  const units = 2 * quantity + 1
  const packDiscount = unit * quantity - price
  const packs = packDiscount > 0 ? Math.floor(units / quantity) : 0
  return { units, unitMinor: unit, totalMinor: unit * units - packs * packDiscount, noBenefit: packDiscount <= 0 }
}
