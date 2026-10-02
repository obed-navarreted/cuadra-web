import createClient, { type Middleware } from 'openapi-fetch'
import { clearSession, endViewAs, getToken, getViewAs } from '../auth/session'
import { API_BASE } from './base'
import type { paths } from './schema'

/** Error de la API con el `code` estable (Problem Details) para traducirlo en pantalla. */
export class ApiError extends Error {
  readonly status: number
  readonly code: string
  /** Solo en `PLAN_LIMIT`: qué función topó (MEMBERS, DEVICES…) y el tope del plan. */
  readonly feature?: string
  readonly limit?: number
  /** Solo en `REGISTER_QUEUE_NOT_EMPTY`: cuántas cuentas por cobrar en caja hay y cuánto suman. */
  readonly count?: number
  readonly totalMinor?: number

  constructor(status: number, code: string, message: string, extra: { feature?: string; limit?: number; count?: number; totalMinor?: number } = {}) {
    super(message)
    this.status = status
    this.code = code
    this.feature = extra.feature
    this.limit = extra.limit
    this.count = extra.count
    this.totalMinor = extra.totalMinor
  }
}

const auth: Middleware = {
  onRequest({ request }) {
    const token = getToken()
    if (token) request.headers.set('Authorization', `Bearer ${token}`)
    return request
  },
  onResponse({ response }) {
    // Una sesión que el servidor ya no reconoce se cierra: la app vuelve a la pantalla de entrada.
    // En "Ver como" el que venció es el token de solo lectura: se vuelve a la sesión del admin (y a la consola), no se cierra sesión.
    if (response.status === 401 && getToken()) {
      if (getViewAs()) endViewAs()
      else clearSession()
    }
    return response
  },
}

/** Cliente tipado generado del contrato (`docs/openapi.json` → `src/api/schema.d.ts`; ver `npm run gen:api`). */
// `fetch` se resuelve en cada llamada (no al cargar el módulo): así las pruebas pueden sustituirlo.
export const client = createClient<paths>({ baseUrl: API_BASE, fetch: (request) => globalThis.fetch(request) })
client.use(auth)

type Reply<T> = { data?: T; error?: unknown; response: Response }

/** Devuelve el cuerpo o lanza `ApiError`. Un fallo de red también es un `ApiError` (`OFFLINE`). */
export async function call<T>(request: Promise<Reply<T>>): Promise<T> {
  let reply: Reply<T>
  try {
    reply = await request
  } catch {
    throw new ApiError(0, 'OFFLINE', 'Cannot reach the server')
  }
  if (!reply.response.ok) {
    const body = reply.error as { code?: string; detail?: string; feature?: string; limit?: number; count?: number; totalMinor?: number } | undefined
    throw new ApiError(reply.response.status, body?.code ?? `HTTP_${reply.response.status}`, body?.detail ?? reply.response.statusText, { feature: body?.feature, limit: body?.limit, count: body?.count, totalMinor: body?.totalMinor })
  }
  return reply.data as T
}

/** Descarga un CSV con la sesión (un enlace normal no puede llevar el token). */
export async function downloadFile(path: string, params: Record<string, string | number | undefined> = {}, filename?: string): Promise<void> {
  const url = new URL(path, API_BASE)
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '') url.searchParams.set(k, String(v))
  const token = getToken()
  let res: Response
  try {
    res = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
  } catch {
    throw new ApiError(0, 'OFFLINE', 'Cannot reach the server')
  }
  if (!res.ok) {
    let code = `HTTP_${res.status}`
    let extra: { feature?: string; limit?: number } = {}
    try {
      const body = (await res.json()) as { code?: string; feature?: string; limit?: number }
      code = body.code ?? code
      extra = { feature: body.feature, limit: body.limit }
    } catch {
      /* sin JSON */
    }
    throw new ApiError(res.status, code, res.statusText, extra)
  }
  const name = filename ?? /filename="?([^";]+)"?/.exec(res.headers.get('Content-Disposition') ?? '')?.[1] ?? 'cuadra.csv'
  const blobUrl = URL.createObjectURL(await res.blob())
  const a = document.createElement('a')
  a.href = blobUrl
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(blobUrl)
}
