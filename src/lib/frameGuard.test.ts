import { describe, expect, it } from 'vitest'
import { guardFraming, isFramed } from './frameGuard'

describe('frameGuard', () => {
  it('no hace nada si la página es la ventana superior', () => {
    expect(isFramed(window)).toBe(false)
    expect(guardFraming(window, document)).toBe(false)
  })
  it('dentro de un marco oculta la app y muestra un aviso', () => {
    document.body.innerHTML = '<div id="root"><p>app</p></div>'
    const fake = { top: {}, self: {}, location: window.location } as unknown as Window
    expect(isFramed(fake)).toBe(true)
    expect(guardFraming(fake, document)).toBe(true)
    expect(document.getElementById('root')?.hidden).toBe(true)
    expect(document.querySelector('[role=alert]')).toHaveTextContent(/no se puede usar dentro de otra página/)
    document.body.innerHTML = ''
  })
  it('si no puede leer window.top lo trata como enmarcada', () => {
    const fake = Object.defineProperty({}, 'top', { get() { throw new Error('x') } }) as Window
    expect(isFramed(fake)).toBe(true)
  })
})
