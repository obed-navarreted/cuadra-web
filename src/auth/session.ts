/**
 * La sesión web es el token de la API (Bearer). Se guarda en `localStorage` para que sobreviva a recargar la página; quien controle el navegador
 * puede leerlo, igual que con cualquier sesión web. Cerrar sesión lo borra y avisa a la API.
 */
const KEY = 'cuadra.session'
const BUSINESS_KEY = 'cuadra.business'

let memory: string | null = null

type Listener = () => void
const listeners = new Set<Listener>()

function read(): { token: string } | null {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as { token: string }) : null
  } catch {
    return null
  }
}

export function getToken(): string | null {
  return read()?.token ?? memory
}

export function setToken(token: string) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ token }))
  } catch {
    /* sin almacenamiento: la sesión dura lo que dure la pestaña */
    memory = token
  }
  notify()
}

/**
 * Cierra la sesión Y olvida todo lo que era del negocio o de la persona (ADR 0014): el negocio elegido y quién era el usuario. Quien entre después en este
 * navegador no hereda nada. (El idioma es una preferencia del navegador, no de la cuenta: se queda.)
 */
export function clearSession() {
  memory = null
  adminMemory = null
  viewAsMemory = null
  businessMemory = null
  userMemory = null
  try {
    localStorage.removeItem(KEY)
    localStorage.removeItem(ADMIN_KEY)
    localStorage.removeItem(VIEW_AS_KEY)
    localStorage.removeItem(BUSINESS_KEY)
    localStorage.removeItem(USER_KEY)
  } catch {
    /* nada que borrar */
  }
  notify()
}

/**
 * "Ver como" (consola de plataforma): la sesión del admin se aparta y la activa pasa a ser el token de solo lectura del negocio mirado.
 * Al salir (o si ese token vence) se restaura la del admin. Todo queda en `localStorage` para que sobreviva a recargar la página.
 */
const ADMIN_KEY = 'cuadra.session.admin'
const VIEW_AS_KEY = 'cuadra.viewas'

export type ViewAsInfo = { businessId: string; businessName: string; expiresAt: string }

let adminMemory: string | null = null
let viewAsMemory: string | null = null
let viewAsRaw: string | null = null
let viewAsParsed: ViewAsInfo | null = null

function readKey(key: string, fallback: string | null): string | null {
  try {
    return localStorage.getItem(key) ?? fallback
  } catch {
    return fallback
  }
}

/** La sesión "Ver como" activa, o null. Devuelve el mismo objeto mientras no cambie (sirve para `useSyncExternalStore`). */
export function getViewAs(): ViewAsInfo | null {
  const raw = readKey(VIEW_AS_KEY, viewAsMemory)
  if (raw === viewAsRaw) return viewAsParsed
  viewAsRaw = raw
  try {
    viewAsParsed = raw ? (JSON.parse(raw) as ViewAsInfo) : null
  } catch {
    viewAsParsed = null
  }
  return viewAsParsed
}

export function startViewAs(token: string, info: ViewAsInfo) {
  // Si ya se estaba mirando otro negocio, la sesión del admin sigue siendo la que se apartó primero.
  if (!getViewAs()) {
    const admin = getToken()
    adminMemory = admin
    try {
      if (admin) localStorage.setItem(ADMIN_KEY, admin)
    } catch {
      /* queda en memoria */
    }
  }
  viewAsMemory = JSON.stringify(info)
  try {
    localStorage.setItem(VIEW_AS_KEY, viewAsMemory)
  } catch {
    /* queda en memoria */
  }
  setToken(token)
}

/** Sale de "Ver como" y devuelve la sesión del admin. Si no había una guardada, cierra la sesión. */
export function endViewAs(): boolean {
  if (!getViewAs()) return false
  const admin = readKey(ADMIN_KEY, adminMemory)
  adminMemory = null
  viewAsMemory = null
  try {
    localStorage.removeItem(ADMIN_KEY)
    localStorage.removeItem(VIEW_AS_KEY)
  } catch {
    /* nada que borrar */
  }
  if (admin) setToken(admin)
  else clearSession()
  return true
}

export function subscribe(l: Listener) {
  listeners.add(l)
  return () => listeners.delete(l)
}

function notify() {
  listeners.forEach((l) => l())
}

const USER_KEY = 'cuadra.user'
let businessMemory: string | null = null
let userMemory: string | null = null

export function savedBusiness(): string | null {
  try {
    return localStorage.getItem(BUSINESS_KEY) ?? businessMemory
  } catch {
    return businessMemory
  }
}

export function saveBusiness(id: string) {
  businessMemory = id
  try {
    localStorage.setItem(BUSINESS_KEY, id)
  } catch {
    /* se elige de nuevo la próxima vez */
  }
}

/**
 * Se llama con el usuario que la API reconoció. Si no es el mismo de la vez anterior en este navegador (otra cuenta, o el token cambió sin cerrar sesión),
 * el negocio elegido de aquella persona se olvida: ninguna cuenta hereda la elección de otra.
 */
export function rememberUser(userId: string) {
  let previous: string | null = userMemory
  try {
    previous = localStorage.getItem(USER_KEY) ?? previous
  } catch {
    /* sin almacenamiento */
  }
  if (previous !== null && previous !== userId) {
    businessMemory = null
    try {
      localStorage.removeItem(BUSINESS_KEY)
    } catch {
      /* nada que borrar */
    }
  }
  userMemory = userId
  try {
    localStorage.setItem(USER_KEY, userId)
  } catch {
    /* queda en memoria */
  }
}
