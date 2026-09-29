import { describe, expect, it } from 'vitest'
import { buildRows, guessMapping, normalizeHeader, STOCK_FIELDS, FIELDS } from './importMapping'

describe('mapeo de columnas', () => {
  it('reconoce encabezados en español e inglés, con acentos y mayúsculas', () => {
    expect(guessMapping(['Nombre', 'Código de Barras', 'PRECIO', 'Costo', 'Unidad', 'Categoría', 'Existencia', 'Mínimo'])).toEqual([
      'name', 'barcode', 'price', 'cost', 'unit', 'category', 'stock', 'minStock',
    ])
    expect(guessMapping(['name', 'barcode', 'price', 'cost', 'unit', 'category', 'stock', 'min'])).toEqual(['name', 'barcode', 'price', 'cost', 'unit', 'category', 'stock', 'minStock'])
  })

  it('una columna desconocida se ignora y un campo no se asigna dos veces', () => {
    expect(guessMapping(['Nombre', 'Producto', 'Color'])).toEqual(['name', null, null])
  })

  it('sin inventario no se asignan columnas de existencia', () => {
    const allowed = FIELDS.filter((f) => !STOCK_FIELDS.includes(f))
    expect(guessMapping(['Nombre', 'Existencia', 'Control'], allowed)).toEqual(['name', null, null])
  })

  it('normaliza sin acentos ni signos', () => {
    expect(normalizeHeader('  Código_de-Barras ')).toBe('codigo de barras')
  })
})

describe('filas para el servidor', () => {
  const mapping = guessMapping(['Nombre', 'Precio', 'Existencia'])

  it('la línea 2 es la primera fila de datos', () => {
    const rows = buildRows([['Queso', '90', '12'], ['Pan', '5', '']], mapping)
    expect(rows.map((r) => r.line)).toEqual([2, 3])
  })

  it('las celdas vacías no se envían y los espacios se recortan', () => {
    expect(buildRows([['  Pan ', ' ', '']], mapping)).toEqual([{ line: 2, name: 'Pan' }])
  })

  it('una fila totalmente vacía se salta pero cuenta para el número de línea', () => {
    const rows = buildRows([['Queso', '1', ''], [' ', '', ''], ['Pan', '2', '']], mapping)
    expect(rows.map((r) => r.line)).toEqual([2, 4])
  })

  it('una fila corta (menos celdas que columnas) no falla', () => {
    expect(buildRows([['Pan']], mapping)).toEqual([{ line: 2, name: 'Pan' }])
  })
})
