import { parseMoney } from '../../lib/money'
import type { ExpenseCategory, ExpenseSummary, Source } from './types'

/** Etiqueta de una categoría: si el negocio la renombró, su nombre; si es de fábrica, la traducción de su clave (`goods` → "Mercadería"). */
export function categoryLabel(c: { key?: string | null; name?: string | null }, translate: (key: string) => string | null): string {
  if (c.name) return c.name
  return (c.key && translate(c.key)) || c.key || ''
}

/** Barras proporcionales al mayor: 0–100. */
type CategoryTotal = NonNullable<ExpenseSummary['byCategory']>[number]
export function bars(byCategory: CategoryTotal[]): { row: CategoryTotal; percent: number }[] {
  const max = Math.max(1, ...byCategory.map((c) => c.amountMinor))
  return byCategory.map((row) => ({ row, percent: Math.round((100 * row.amountMinor) / max) }))
}

export type ExpenseDraft = { amount: string; description: string; categoryId: string; source: Source; date: string }

export type DraftCheck = { ok: true; amountMinor: number } | { ok: false; error: 'amount' | 'date' | 'description' }

/** Valida el formulario de un gasto antes de llamar a la API (el servidor valida igual; esto evita ir y volver por un error de captura). */
export function checkDraft(d: ExpenseDraft, currency: string, today: string): DraftCheck {
  const amountMinor = parseMoney(d.amount, currency)
  if (amountMinor === null || amountMinor <= 0) return { ok: false, error: 'amount' }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d.date) || d.date > today) return { ok: false, error: 'date' }
  if (d.description.trim().length > 200) return { ok: false, error: 'description' }
  return { ok: true, amountMinor }
}

function offsetMinutes(utcMs: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).formatToParts(new Date(utcMs))
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value)
  return (Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second')) - utcMs) / 60000
}

/**
 * Un gasto de una fecha pasada se guarda al mediodía de ESA fecha en la zona del negocio (así cae en la jornada correcta con cualquier hora de corte).
 * Un gasto de hoy no manda hora: el servidor usa el momento en que llega.
 */
export function occurredAtFor(date: string, today: string, timeZone: string): string | undefined {
  if (date >= today) return undefined
  const [y, m, d] = date.split('-').map(Number)
  const guess = Date.UTC(y, m - 1, d, 12)
  return new Date(guess - offsetMinutes(guess, timeZone) * 60000).toISOString()
}

export function splitVoided<T extends { voided: boolean }>(rows: T[]): { active: T[]; voided: T[] } {
  return { active: rows.filter((r) => !r.voided), voided: rows.filter((r) => r.voided) }
}

export function visibleCategories(all: ExpenseCategory[], includeHidden = false): ExpenseCategory[] {
  return includeHidden ? all : all.filter((c) => c.active)
}
