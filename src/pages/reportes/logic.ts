import type { components } from '../../api/schema'
/** Lógica pura de Resumen y Reportes: sin React ni red, para poder probarla con números conocidos. */

import { decimalsOf } from '../../lib/money'

/** Porcentaje entero de `part` sobre `total` (0 si no hay total). */
export function share(part: number, total: number): number {
  return total > 0 ? Math.round((100 * part) / total) : 0
}

/** Una fila del desglose por persona (lo mínimo que usa la lógica de «Cobró / Atendió»). */
type PersonRow = { key?: string | null; count: number; totalMinor: number }

/**
 * ¿Se ofrece «Cobró / Atendió»? Si el negocio usa «Cobro en caja», o si en el rango alguna venta la atendió una persona y la cobró otra
 * (los dos desgloses se reparten distinto).
 */
export function showServedToggle(registerCheckout: boolean, charged: PersonRow[] | undefined, served: PersonRow[] | undefined): boolean {
  if (registerCheckout) return true
  if (!charged || !served) return false
  const sig = (rows: PersonRow[]) => rows.map((r) => `${r.key ?? ''}|${r.count}|${r.totalMinor}`).sort().join(';')
  return sig(charged) !== sig(served)
}

/** Las primeras `limit` personas, de más a menos vendido; con 6 se ven las 6 (esconder una sola fila no ahorra nada). */
export function topPeople<T extends { totalMinor: number }>(rows: T[], showAll: boolean, limit = 5): { shown: T[]; hidden: number } {
  const sorted = [...rows].sort((a, b) => b.totalMinor - a.totalMinor)
  if (showAll || sorted.length <= limit + 1) return { shown: sorted, hidden: 0 }
  return { shown: sorted.slice(0, limit), hidden: sorted.length - limit }
}

/** Ancho de una barra respecto al mayor valor (nunca negativo ni mayor a 100). */
export function barPercent(value: number, max: number): number {
  return max > 0 ? Math.max(0, Math.min(100, (100 * value) / max)) : 0
}

/**
 * Escala del eje vertical: el máximo "redondo" (1, 2, 5 × 10ⁿ) por encima del mayor valor y las marcas intermedias.
 * Con todo en cero devuelve una escala mínima para que el gráfico vacío no divida entre cero.
 */
export function niceScale(maxValue: number, ticks = 4): { max: number; ticks: number[] } {
  if (!(maxValue > 0)) return { max: ticks, ticks: Array.from({ length: ticks + 1 }, (_, i) => i) }
  const rough = maxValue / ticks
  const pow = 10 ** Math.floor(Math.log10(rough))
  const unit = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((s) => s * ticks >= maxValue) ?? 10 * pow
  return { max: unit * ticks, ticks: Array.from({ length: ticks + 1 }, (_, i) => i * unit) }
}

/** Marca del eje en unidades mayores y notación compacta ("2.5 k"): el eje nunca lleva centavos. */
export function axisLabel(minor: number, decimals: number, language: string): string {
  return new Intl.NumberFormat(language, { notation: 'compact', maximumFractionDigits: 1 }).format(minor / 10 ** decimals)
}

export type ClosingKind = 'balanced' | 'short' | 'over'

/** contado − esperado: 0 cuadró, negativo faltó, positivo sobró. */
export function closingKind(differenceMinor: number): ClosingKind {
  return differenceMinor === 0 ? 'balanced' : differenceMinor < 0 ? 'short' : 'over'
}

/** El costo no cubre todo lo vendido: la ganancia mostrada podría ser mayor que la real. */
export function coverageIncomplete(percent: number): boolean {
  return percent < 100
}

/** Cada cuántos días poner la etiqueta del eje horizontal para que no se encimen (según el espacio por día). */
export function labelEvery(days: number, pxPerDay: number, minLabelPx = 34): number {
  return Math.max(1, Math.ceil(minLabelPx / Math.max(1, pxPerDay)) + (days > 62 ? 1 : 0))
}

/** CSV según RFC 4180, con BOM para Excel; una celda que empieza con = + - @ se neutraliza para que no se abra como fórmula. */
export function toCsv(header: string[], rows: (string | number)[][]): string {
  const cell = (v: string | number): string => {
    const s = String(v)
    const safe = /^[=+\-@]/.test(s) && !/^-?\d+([.,]\d+)?$/.test(s) ? `'${s}` : s
    return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
  }
  return '﻿' + [header, ...rows].map((r) => r.map(cell).join(',')).join('\r\n') + '\r\n'
}

/** Descarga un texto como archivo desde el navegador. */
export function saveText(filename: string, text: string, type = 'text/csv;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([text], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

/** Una fila del reporte "ventas por…" (persona, caja, método, hora o día). */
export type BreakdownRow = components['schemas']['Row']

/** Monto para un CSV: decimales planos ("342.50"), sin símbolo ni separador de miles, con los decimales de la moneda. */
export function plainAmount(minor: number, currency: string): string {
  const d = decimalsOf(currency)
  return new Intl.NumberFormat('en', { useGrouping: false, minimumFractionDigits: d, maximumFractionDigits: d }).format(minor / 10 ** d)
}
