import { parseMoney } from '../../lib/money'

/** Cantidad escrita por una persona ("12", "0,75", "2.500") → milésimas; `null` si no es válida (más de 3 decimales, negativa o texto). */
export function parseQuantity(text: string): number | null {
  const s = text.trim().replace(',', '.')
  if (!/^\d{1,9}(\.\d+)?$/.test(s)) return null
  const [whole, frac = ''] = s.split('.')
  if (frac.replace(/0+$/, '').length > 3) return null
  return Number(whole) * 1000 + Number(frac.padEnd(3, '0').slice(0, 3) || 0)
}

/** Milésimas → texto editable ("12500" → "12.5"). */
export function quantityInput(milli: number | null | undefined): string {
  // La API manda `null` explícito para lo que no tiene valor: por eso `== null`.
  if (milli == null) return ''
  return String(milli / 1000)
}

/** Unidad menor → texto editable ("1250" → "12.50"). */
export function moneyInput(minor: number | null | undefined, decimals: number): string {
  if (minor == null) return ''
  return (minor / 10 ** decimals).toFixed(decimals)
}

/** round_half_up(costo × cantidad / 1000): igual que el servidor (`SaleMath.lineTotal`). */
export function lineTotal(unitCostMinor: number, quantityMilli: number): number {
  return Math.floor((unitCostMinor * quantityMilli + 500) / 1000)
}

export { parseMoney }
