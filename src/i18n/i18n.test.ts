import { describe, expect, it } from 'vitest'
import { buildResources } from './index'

/** Todas las claves de un idioma existen en el otro, en CADA área (el plan lo exige en CI, sección 7.4). */
function keys(obj: Record<string, unknown>, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([k, v]) =>
    v && typeof v === 'object' ? keys(v as Record<string, unknown>, `${prefix}${k}.`) : [`${prefix}${k}`],
  )
}

const resources = buildResources()

describe('i18n', () => {
  it('es y en tienen las mismas áreas', () => {
    expect(Object.keys(resources.en).sort()).toEqual(Object.keys(resources.es).sort())
  })

  for (const ns of Object.keys(resources.es)) {
    it(`área "${ns}": es y en tienen exactamente las mismas claves`, () => {
      expect(keys(resources.en[ns]).sort()).toEqual(keys(resources.es[ns]).sort())
    })

    it(`área "${ns}": ninguna traducción está vacía y los {{parámetros}} coinciden`, () => {
      const flat = (o: Record<string, unknown>) => Object.fromEntries(keys(o).map((k) => [k, k.split('.').reduce<unknown>((x, p) => (x as Record<string, unknown>)[p], o) as string]))
      const es = flat(resources.es[ns])
      const en = flat(resources.en[ns])
      for (const k of Object.keys(es)) {
        expect(String(es[k]).trim(), `${ns}.${k} (es)`).not.toBe('')
        expect(String(en[k]).trim(), `${ns}.${k} (en)`).not.toBe('')
        const params = (s: string) => (s.match(/\{\{\w+\}\}/g) ?? []).sort()
        expect(params(String(en[k])), `${ns}.${k}`).toEqual(params(String(es[k])))
      }
    })
  }
})
