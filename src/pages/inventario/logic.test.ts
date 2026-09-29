import { beforeAll, describe, expect, it } from 'vitest'
import i18n, { setLocale } from '../../i18n'
import { describeChange, describeEntry, formatValue, type HistoryDeps } from './logic'
import type { ProductHistoryEntry } from './types'

let deps: HistoryDeps
beforeAll(async () => {
  await setLocale('es')
  deps = { t: i18n.getFixedT('es', 'inventario') as HistoryDeps['t'], money: (m) => `C$ ${(m / 100).toFixed(2)}`, quantity: (m) => String(m / 1000) }
})

const entry = (over: Partial<ProductHistoryEntry>): ProductHistoryEntry => ({ id: 1, action: 'product.update', actorName: 'Ana', actorRole: 'ADMIN', at: '2026-01-01T10:00:00Z', changes: {}, ...over })

describe('historial de producto', () => {
  it('dinero con el formato del negocio', () => {
    expect(describeChange('priceMinor', { from: 2500, to: 3000 }, deps)).toBe('Precio: C$ 25.00 → C$ 30.00')
    expect(describeChange('costMinor', { from: 100, to: 150 }, deps)).toBe('Costo: C$ 1.00 → C$ 1.50')
  })
  it('cambio de nombre', () => {
    expect(describeChange('name', { from: 'A', to: 'B' }, deps)).toBe('Nombre: A → B')
  })
  it('baja y reactivación', () => {
    expect(describeChange('active', { from: true, to: false }, deps)).toBe('Dado de baja')
    expect(describeChange('active', { from: false, to: true }, deps)).toBe('Reactivado')
    expect(describeEntry(entry({ action: 'product.deactivate', changes: { active: { from: true, to: false } } }), deps)).toEqual(['Dado de baja'])
    expect(describeEntry(entry({ action: 'product.deactivate', changes: {} }), deps)).toEqual(['Dado de baja'])
  })
  it('creación con precio', () => {
    expect(describeEntry(entry({ action: 'product.create', changes: { name: { from: null, to: 'Leche' }, priceMinor: { from: null, to: 2500 } } }), deps)).toEqual(['Creado por Ana con precio C$ 25.00'])
    expect(describeEntry(entry({ action: 'product.create', actorName: null, changes: {} }), deps)).toEqual(['Creado por Alguien'])
  })
  it('de nulo a valor y de valor a nulo', () => {
    expect(describeChange('costMinor', { from: null, to: 150 }, deps)).toBe('Costo: — → C$ 1.50')
    expect(describeChange('barcode', { from: '123', to: null }, deps)).toBe('Código de barras: 123 → —')
    expect(describeChange('costMinor', undefined, deps)).toBe('Costo: — → —')
  })
  it('booleanos, unidades y categoría', () => {
    expect(describeChange('trackStock', { from: false, to: true }, deps)).toBe('Control de existencia: No → Sí')
    expect(formatValue('unit', 'KG', deps)).toBe('kg')
    expect(formatValue('categoryId', 'c1', { ...deps, categoryName: () => 'Lácteos' })).toBe('Lácteos')
    expect(formatValue('categoryId', 'c1', deps)).toBe('otra categoría')
  })
  it('campo desconocido: nombre crudo y valores tal cual', () => {
    expect(describeChange('futureField', { from: 1, to: { x: 2 } }, deps)).toBe('futureField: 1 → {"x":2}')
    expect(describeEntry(entry({ changes: {} }), deps)).toEqual(['Sin cambios de datos'])
  })
})
