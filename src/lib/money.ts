/** Mismos decimales que el servidor y la app: estas monedas no usan centavos. */
const ZERO_DECIMALS = new Set(['CRC', 'COP', 'CLP', 'PYG'])

export function decimalsOf(currency: string): number {
  return ZERO_DECIMALS.has(currency.toUpperCase()) ? 0 : 2
}

/**
 * Dinero en unidad menor → texto ("C$ 342.50"). El formato sigue al PAÍS del negocio, no al idioma de quien mira: un cajero que usa la app en inglés
 * ve igual "C$ 342.50". Si el país no da un formato conocido se usa el idioma.
 */
export function formatMoney(minor: number, currency: string, country: string | undefined, language: string): string {
  const decimals = decimalsOf(currency)
  const value = minor / 10 ** decimals
  const candidates = [country ? `es-${country}` : '', language].filter(Boolean)
  for (const locale of candidates) {
    try {
      const parts = new Intl.NumberFormat(locale, { style: 'currency', currency, minimumFractionDigits: decimals, maximumFractionDigits: decimals }).formatToParts(value)
      // Algunas configuraciones regionales pegan el símbolo a la cifra ("C$885.02"); la app y el resto del producto lo muestran con espacio ("C$ 885.02").
      return parts.map((p, i) => (p.type === 'currency' && parts[i + 1] && parts[i + 1].type !== 'literal' ? `${p.value}\u00a0` : p.value)).join('')
    } catch {
      /* configuración regional o moneda desconocida: se prueba la siguiente */
    }
  }
  return `${currency} ${value.toFixed(decimals)}`
}

/** Cantidad en milésimas → "12.5" (sin ceros de más). */
export function formatQuantity(milli: number, language: string): string {
  return new Intl.NumberFormat(language, { maximumFractionDigits: 3 }).format(milli / 1000)
}

/**
 * Quita los separadores de miles cuando no hay duda: con los dos separadores ("1,000.00", "1.000,00") el decimal es el ÚLTIMO; un separador repetido
 * ("1.000.000") es de miles. Un solo separador se deja como decimal ("12,50"). Grupos de miles mal formados se devuelven tal cual (y no validan).
 * La misma regla que la importación de productos del servidor (`ProductImportService.canonicalNumber`), salvo que allí "1,000" con dinero es mil.
 */
export function normalizeNumber(text: string): string {
  const s = text.trim().replace(/[\s\u00a0]/g, '')
  const comma = s.lastIndexOf(',')
  const dot = s.lastIndexOf('.')
  if (comma < 0 && dot < 0) return s
  let dec: string | null
  let group: string
  if (comma >= 0 && dot >= 0) {
    dec = comma > dot ? ',' : '.'
    group = dec === ',' ? '.' : ','
  } else {
    const sep = comma >= 0 ? ',' : '.'
    const count = s.split(sep).length - 1
    dec = count > 1 ? null : sep
    group = sep
  }
  let intPart = s
  let frac: string | null = null
  if (dec) {
    const at = s.lastIndexOf(dec)
    intPart = s.slice(0, at)
    frac = s.slice(at + 1)
  }
  if (intPart.includes(group)) {
    const re = new RegExp(`^\\d{1,3}(\\${group}\\d{3})+$`)
    if (!re.test(intPart)) return s
    intPart = intPart.split(group).join('')
  }
  return frac == null ? intPart : `${intPart}.${frac}`
}

/** Texto escrito por una persona ("12.50", "12,50", "1,250.50") → unidad menor; `null` si no es un monto válido para la moneda. */
export function parseMoney(text: string, currency: string): number | null {
  const s = normalizeNumber(text)
  if (!/^\d{1,12}(\.\d+)?$/.test(s)) return null
  const decimals = decimalsOf(currency)
  const [whole, frac = ''] = s.split('.')
  if (frac.replace(/0+$/, '').length > decimals) return null
  return Number(whole) * 10 ** decimals + Number(frac.padEnd(decimals, '0').slice(0, decimals) || 0)
}
