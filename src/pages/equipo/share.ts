import { useEffect, useRef, useState } from 'react'

/** Copia al portapapeles; false si el navegador no lo permite. */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

/** Comparte con la hoja del sistema (Web Share API) si existe; si no, copia. Devuelve qué pasó ('cancelled' si la persona cerró la hoja). */
export async function shareText(title: string, text: string): Promise<'shared' | 'copied' | 'cancelled' | 'failed'> {
  if (typeof navigator.share === 'function') {
    try {
      await navigator.share({ title, text })
      return 'shared'
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return 'cancelled'
      // Cualquier otro fallo: se intenta copiar.
    }
  }
  return (await copyText(text)) ? 'copied' : 'failed'
}

/** Estado "copiado / no se pudo" que se apaga solo. */
export function useFeedback(): { state: 'copied' | 'failed' | null; set: (s: 'copied' | 'failed' | null) => void } {
  const [state, setState] = useState<'copied' | 'failed' | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => () => clearTimeout(timer.current), [])
  return {
    state,
    set: (s) => {
      clearTimeout(timer.current)
      setState(s)
      if (s) timer.current = setTimeout(() => setState(null), 3000)
    },
  }
}
