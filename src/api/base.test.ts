import { describe, expect, it } from 'vitest'
import { resolveApiBase } from './base'
import { apiOrigin, buildCsp, normalizeBase } from '../../vite.config'

describe('base de la API', () => {
  it('sin VITE_API_URL usa el origen de la página', () => {
    expect(resolveApiBase(undefined, 'http://localhost:5173')).toBe('http://localhost:5173')
    expect(resolveApiBase('  ', 'http://x')).toBe('http://x')
  })
  it('quita la barra final', () => {
    expect(resolveApiBase('https://api.example.com/', 'http://x')).toBe('https://api.example.com')
    expect(resolveApiBase('https://api.example.com//', 'http://x')).toBe('https://api.example.com')
  })
})

describe('CSP y base de publicación', () => {
  it('connect-src suma el origen de la API sin path y mantiene lo demás estricto', () => {
    const csp = buildCsp('https://api.example.com/v1/')
    expect(csp).toContain("connect-src 'self' https://accounts.google.com https://api.example.com;")
    expect(csp).not.toContain('unsafe-eval')
    expect(csp).toContain("script-src 'self' https://accounts.google.com/gsi/client;")
  })
  it('sin API o con valor inválido no agrega nada', () => {
    expect(buildCsp()).toContain("connect-src 'self' https://accounts.google.com;")
    expect(apiOrigin('javascript:alert(1)')).toBe('')
    expect(apiOrigin('no es url')).toBe('')
  })
  it('normaliza VITE_BASE', () => {
    expect(normalizeBase(undefined)).toBe('/')
    expect(normalizeBase('/')).toBe('/')
    expect(normalizeBase('cuadra')).toBe('/cuadra/')
    expect(normalizeBase('/cuadra/')).toBe('/cuadra/')
  })
})
