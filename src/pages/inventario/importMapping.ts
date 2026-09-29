/** Columnas que entiende la importación del servidor (`ProductImportService.Row`). */
export const FIELDS = ['name', 'variant', 'barcode', 'shortCode', 'price', 'cost', 'unit', 'category', 'trackStock', 'stock', 'minStock'] as const
export type Field = (typeof FIELDS)[number]

/** Columnas que solo tienen sentido si el negocio lleva inventario. */
export const STOCK_FIELDS: Field[] = ['trackStock', 'stock', 'minStock']

export const MAX_ROWS = 2000

/** Una columna del archivo → un campo (o `null` = ignorarla). */
export type Mapping = (Field | null)[]

export type ImportRow = { line: number } & Partial<Record<Field, string>>

const SYNONYMS: Record<Field, string[]> = {
  name: ['nombre', 'name', 'producto', 'product', 'articulo', 'item', 'descripcion', 'description'],
  variant: ['variante', 'variant', 'presentacion', 'tamano', 'size'],
  barcode: ['codigo', 'codigo de barras', 'barcode', 'codigobarras', 'ean', 'upc', 'sku', 'code'],
  shortCode: ['codigo corto', 'codcorto', 'shortcode', 'short code', 'atajo'],
  price: ['precio', 'price', 'precio de venta', 'precio venta', 'pvp', 'sale price'],
  cost: ['costo', 'cost', 'precio de compra', 'precio compra', 'costo unitario'],
  unit: ['unidad', 'unit', 'medida', 'um'],
  category: ['categoria', 'category', 'rubro', 'grupo', 'group', 'familia'],
  trackStock: ['control', 'controla', 'controlar', 'track', 'trackstock', 'track stock', 'llevar control', 'inventario', 'controla existencia'],
  stock: ['existencia', 'existencias', 'stock', 'cantidad', 'quantity', 'qty', 'inventario actual', 'on hand'],
  minStock: ['minimo', 'min', 'minstock', 'stock minimo', 'existencia minima', 'minimum', 'punto de pedido'],
}

/** Minúsculas, sin acentos y sin signos: "Código de Barras" → "codigo de barras". */
export function normalizeHeader(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/** Adivina el mapeo por el nombre del encabezado (es/en). Un campo no se asigna a dos columnas: gana la primera. */
export function guessMapping(headers: string[], allowed: readonly Field[] = FIELDS): Mapping {
  const used = new Set<Field>()
  return headers.map((h) => {
    const n = normalizeHeader(h)
    const field = FIELDS.find((f) => allowed.includes(f) && !used.has(f) && (SYNONYMS[f].includes(n) || normalizeHeader(f) === n))
    if (field) used.add(field)
    return field ?? null
  })
}

/**
 * Filas para el servidor. `line` es la línea del archivo: la fila 2 es la primera de datos (la 1 es el encabezado), así el error "línea 7" se busca directo
 * en la hoja de cálculo. Las filas totalmente vacías se saltan; las celdas vacías no se envían (así no pisan lo que ya tiene el producto).
 */
export function buildRows(data: string[][], mapping: Mapping): ImportRow[] {
  const rows: ImportRow[] = []
  data.forEach((cells, index) => {
    const row: ImportRow = { line: index + 2 }
    let any = false
    mapping.forEach((field, col) => {
      const value = cells[col]?.trim()
      if (field && value) {
        row[field] = value
        any = true
      }
    })
    if (any) rows.push(row)
  })
  return rows
}

export const TEMPLATE_HEADER = ['nombre', 'variante', 'código', 'precio', 'costo', 'unidad', 'categoría', 'control', 'existencia', 'mínimo']

export const TEMPLATE_ROWS: string[][] = [
  ['Queso seco', '', '7501000000017', '90', '60', 'LB', 'Lácteos', 'sí', '12', '3'],
  ['Cuajada', 'Grande', '', '25.50', '', 'UNIT', 'Lácteos', '', '', ''],
]
