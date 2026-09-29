/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { copyFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { defineConfig, loadEnv } from 'vite'

/**
 * Política de contenido del panel (solo en el build de producción; el servidor de desarrollo necesita scripts en línea de Vite).
 * Solo se permite lo que el panel usa: sus propios scripts, Google Identity Services (acceso), las tipografías de Google y la API en el mismo origen.
 * Sin `unsafe-eval` ni scripts en línea. `frame-ancestors` no se puede poner en una etiqueta <meta>: va en la cabecera HTTP (ver README).
 */
/** Origen (esquema + host + puerto) de la API a partir de `VITE_API_URL`; vacío si no hay (misma origin) o no es una URL http(s) válida. */
export function apiOrigin(apiUrl: string | undefined): string {
  if (!apiUrl?.trim()) return ''
  try {
    const u = new URL(apiUrl.trim())
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.origin : ''
  } catch {
    return ''
  }
}

export function buildCsp(apiUrl?: string): string {
  const api = apiOrigin(apiUrl)
  return [
    "default-src 'self'",
    "script-src 'self' https://accounts.google.com/gsi/client",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://accounts.google.com/gsi/style",
    "font-src https://fonts.gstatic.com",
    "img-src 'self' data: https://*.googleusercontent.com",
    `connect-src 'self' https://accounts.google.com${api ? ` ${api}` : ''}`,
    "frame-src https://accounts.google.com",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'self'",
  ].join('; ')
}

/** Base de la ruta de publicación (`VITE_BASE`, p. ej. `/cuadra/` en GitHub Pages): siempre empieza y termina en `/`. */
export function normalizeBase(raw: string | undefined): string {
  const v = (raw ?? '').trim()
  if (!v || v === '/') return '/'
  return `/${v.replace(/^\/+|\/+$/g, '')}/`
}

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  const csp = buildCsp(env.VITE_API_URL)
  return {
    base: normalizeBase(env.VITE_BASE),
    plugins: [
      react(),
      {
        name: 'cuadra-csp',
        transformIndexHtml: (html) => (command === 'build' ? html.replace('<head>', `<head>\n    <meta http-equiv="Content-Security-Policy" content="${csp}" />`) : html),
      },
      {
        // GitHub Pages no tiene "fallback de SPA": una ruta profunda (/cuadra/resumen) sirve 404.html, que es el mismo index.html. `.nojekyll` evita que Jekyll ignore carpetas.
        name: 'cuadra-pages',
        apply: 'build',
        closeBundle() {
          copyFileSync(join('dist', 'index.html'), join('dist', '404.html'))
          writeFileSync(join('dist', '.nojekyll'), '')
        },
      },
    ],
    server: {
      // En desarrollo la web llama a /api y Vite lo reenvía a la API local.
      proxy: { '/api': 'http://localhost:8086' },
    },
    test: {
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
      globals: true,
    },
  }
})
