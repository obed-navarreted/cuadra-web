/** Lector de CSV según RFC 4180, sin dependencias: comillas, comas y saltos de línea dentro de una celda, BOM y separador `,` `;` o tabulador. */
export type Delimiter = ',' | ';' | '\t'

const CANDIDATES: Delimiter[] = [',', ';', '\t']

/** El separador que más aparece FUERA de comillas en la primera línea con contenido (Excel en español exporta con `;`). */
export function detectDelimiter(text: string): Delimiter {
  const clean = text.replace(/^﻿/, '')
  const counts: Record<Delimiter, number> = { ',': 0, ';': 0, '\t': 0 }
  let quoted = false
  let seenContent = false
  for (const ch of clean) {
    if (ch === '"') quoted = !quoted
    else if (!quoted && (ch === '\n' || ch === '\r')) {
      if (seenContent) break
    } else if (!quoted) {
      if (ch.trim() !== '' || ch === '\t') seenContent = true
      if (CANDIDATES.includes(ch as Delimiter)) counts[ch as Delimiter]++
    }
  }
  return CANDIDATES.reduce<Delimiter>((best, d) => (counts[d] > counts[best] ? d : best), ',')
}

export type ParsedCsv = { delimiter: Delimiter; rows: string[][] }

/** Filas de celdas. Las líneas vacías se omiten; una comilla sin cerrar toma el resto del texto como parte de la celda (no se pierde nada en silencio). */
export function parseCsv(text: string, delimiter: Delimiter = detectDelimiter(text)): ParsedCsv {
  const src = text.replace(/^﻿/, '')
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  let wasQuoted = false

  const endCell = () => {
    row.push(cell)
    cell = ''
    wasQuoted = false
  }
  const endRow = () => {
    // Una línea vacía (ninguna celda, texto en blanco y sin comillas) no es una fila; `""` escrito a propósito sí.
    const blankLine = row.length === 0 && cell.trim() === '' && !wasQuoted
    endCell()
    if (!blankLine) rows.push(row)
    row = []
  }

  for (let i = 0; i < src.length; i++) {
    const ch = src[i]
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cell += '"'
          i++
        } else quoted = false
      } else cell += ch
    } else if (ch === '"' && cell === '') {
      quoted = true
      wasQuoted = true
    } else if (ch === delimiter) endCell()
    else if (ch === '\r' || ch === '\n') {
      if (ch === '\r' && src[i + 1] === '\n') i++
      endRow()
    } else cell += ch
  }
  if (cell !== '' || row.length > 0 || wasQuoted) endRow()
  return { delimiter, rows }
}

/** Una celda lista para escribir en un CSV. */
export function csvCell(value: string): string {
  return /[",;\n\r\t]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
}
