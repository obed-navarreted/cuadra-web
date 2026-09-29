import type { ProductHistoryEntry } from './types'

/** Lo mínimo que necesita el formateo: traducir (`t` de `useTranslation('inventario')`) y dar formato al dinero/cantidades del negocio. */
export type HistoryDeps = {
  t: (key: string, options?: Record<string, unknown>) => string
  money: (minor: number) => string
  quantity: (milli: number) => string
  /** Nombre de una categoría por su id (si no se conoce, se muestra un texto genérico). */
  categoryName?: (id: string) => string | undefined
}

const isNil = (v: unknown): v is null | undefined => v === null || v === undefined

/** El valor de un campo como texto legible (nulo = "—", dinero con la moneda del negocio, sí/no, unidades traducidas). */
export function formatValue(field: string, value: unknown, d: HistoryDeps): string {
  if (isNil(value) || value === '') return d.t('history.none')
  switch (field) {
    case 'priceMinor':
    case 'costMinor':
      return typeof value === 'number' ? d.money(value) : String(value)
    case 'minStockMilli':
      return typeof value === 'number' ? d.quantity(value) : String(value)
    case 'isQuick':
    case 'trackStock':
    case 'active':
      return value === true ? d.t('history.yes') : d.t('history.no')
    case 'unit':
      return d.t(`units.${String(value)}`, { defaultValue: String(value) })
    case 'pricing':
      return d.t(`history.pricing.${String(value)}`, { defaultValue: String(value) })
    case 'categoryId':
      return d.categoryName?.(String(value)) ?? d.t('history.otherCategory')
    default:
      return typeof value === 'object' ? JSON.stringify(value) : String(value)
  }
}

/** Una frase por campo cambiado: "Precio: C$ 25.00 → C$ 30.00". Un campo desconocido cae al nombre crudo con sus valores. */
export function describeChange(field: string, change: { from?: unknown; to?: unknown } | null | undefined, d: HistoryDeps): string {
  const from = change?.from
  const to = change?.to
  if (field === 'active') return to === false ? d.t('history.deactivated') : d.t('history.reactivated')
  const label = d.t(`history.field.${field}`, { defaultValue: field })
  return d.t('history.change', { field: label, from: formatValue(field, from, d), to: formatValue(field, to, d) })
}

/** Las líneas de una entrada del historial. La creación se resume en una sola frase; las ediciones y bajas, una por campo. */
export function describeEntry(entry: ProductHistoryEntry, d: HistoryDeps): string[] {
  const changes = entry.changes ?? {}
  if (entry.action === 'product.create') {
    const who = entry.actorName || d.t('history.someone')
    const price = changes.priceMinor?.to
    return [typeof price === 'number' ? d.t('history.created', { who, price: d.money(price) }) : d.t('history.createdNoPrice', { who })]
  }
  if (entry.action === 'product.deactivate' && !('active' in changes)) return [d.t('history.deactivated')]
  const lines = Object.entries(changes).map(([field, change]) => describeChange(field, change, d))
  return lines.length ? lines : [d.t('history.noChanges')]
}
