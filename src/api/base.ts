/**
 * Origen de la API. Sin `VITE_API_URL` es el mismo origen de la página (desarrollo con el proxy de Vite o detrás de un proxy inverso).
 * Con ella (panel publicado en otro dominio, p. ej. GitHub Pages) es la URL de la API, sin la barra final.
 */
export function resolveApiBase(raw: string | undefined, origin: string): string {
  const v = (raw ?? '').trim().replace(/\/+$/, '')
  return v || origin
}

export const API_BASE = resolveApiBase(import.meta.env.VITE_API_URL as string | undefined, window.location.origin)
