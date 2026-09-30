import type { TFunction } from 'i18next'
import type { components } from '../../api/schema'

export type NotificationView = components['schemas']['NotificationView']

const KNOWN = ['LOW_STOCK', 'OUT_OF_STOCK', 'SHIFT_CLOSED', 'SHIFT_DIFFERENCE', 'SHIFT_NOT_CLOSED', 'SALE_DELETED', 'SALE_CONFLICT', 'SALE_RETURNED', 'SALE_UNDONE', 'LATE_AFTER_DISABLE', 'PRICE_CHANGED', 'DEVICE_STALE', 'PIN_LOCKOUT', 'MEMBER_JOINED', 'DAILY_SUMMARY', 'SCHEDULED'] as const
export const NOTIFICATION_TYPES = KNOWN

type Formatters = { money: (minor: number) => string; quantity: (milli: number) => string }

const str = (args: Record<string, unknown> | undefined, k: string) => {
  const v = args?.[k]
  return v == null ? '' : String(v)
}
const num = (args: Record<string, unknown> | undefined, k: string) => {
  const v = Number(args?.[k])
  return Number.isFinite(v) ? v : 0
}

/**
 * El texto de un aviso se arma aquí, en el idioma de la interfaz y con el dinero del negocio, a partir de `type` + `args`.
 * El título y el mensaje del servidor solo se usan si el tipo no se conoce (una versión más nueva del servidor).
 */
export function notificationText(t: TFunction, n: NotificationView, f: Formatters): { title: string; body: string } {
  const a = n.args as Record<string, unknown> | undefined
  const type = n.type ?? ''
  if (!(KNOWN as readonly string[]).includes(type)) return { title: n.title ?? '', body: n.body ?? '' }
  if (type === 'SCHEDULED') return { title: str(a, 'title') || (n.title ?? ''), body: str(a, 'body') || (n.body ?? '') }
  const diff = num(a, 'differenceMinor')
  const result = diff === 0 ? t('avisos:result.balanced') : diff < 0 ? t('avisos:result.short', { amount: f.money(-diff) }) : t('avisos:result.over', { amount: f.money(diff) })
  // Avisos viejos traen solo el texto del servidor ("13 UNIT"): se le quita el código interno de la unidad.
  const stock = a?.stockMilli != null ? `${f.quantity(num(a, 'stockMilli'))}${unitLabel(t, str(a, 'unit'))}` : str(a, 'stock').replace(/\s*UNIT$/, '')
  const p = {
    productName: str(a, 'productName'),
    stock,
    memberName: str(a, 'memberName'),
    result,
    amount: f.money(Math.abs(diff)),
    total: f.money(num(a, 'totalMinor')),
    expenses: f.money(num(a, 'expensesMinor')),
    deviceName: str(a, 'deviceName'),
    pending: str(a, 'pending'),
    salesCount: str(a, 'salesCount'),
    fromPrice: f.money(num(a, 'fromPriceMinor')),
    toPrice: f.money(num(a, 'toPriceMinor')),
    reason: str(a, 'reason'),
    count: num(a, 'count'),
    lateAmount: f.money(num(a, 'amountMinor')),
  }
  // Cambio de precio: el texto dice el antes y el después si cambió el precio; si solo cambió el costo, lo dice así.
  // Bloqueo de la entrada con código de TODO el negocio (10 PIN incorrectos): no trae nombre, nadie sabe quién se equivocó.
  const key = type === 'PRICE_CHANGED' && a?.toPriceMinor == null ? 'PRICE_CHANGED_COST' : type === 'PIN_LOCKOUT' && str(a, 'scope') === 'BUSINESS' ? 'PIN_LOCKOUT_BUSINESS' : type
  return { title: t(`avisos:text.${key}.title`, p), body: t(`avisos:text.${key}.body`, p) }
}

function unitLabel(t: TFunction, unit: string): string {
  return unit && unit !== 'UNIT' ? ` ${t(`avisos:unit.${unit}`, { defaultValue: '' })}`.trimEnd() : ''
}

/** Enlace `cuadra://…` de la app → ruta del panel (o null si esa acción solo existe en el teléfono). */
export function panelRoute(deepLink: string | undefined | null): string | null {
  if (!deepLink) return null
  const m = /^cuadra:\/\/([a-z]+)/.exec(deepLink)
  switch (m?.[1]) {
    case 'fiados':
      return '/fiados'
    case 'inventario':
      return '/inventario'
    case 'gastos':
      return '/gastos'
    case 'cierre':
      return '/cierres'
    case 'notificaciones':
      return '/avisos'
    case 'ventas':
      return '/ventas'
    default:
      return null
  }
}
