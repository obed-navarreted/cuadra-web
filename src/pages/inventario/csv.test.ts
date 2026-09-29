import { describe, expect, it } from 'vitest'
import { csvCell, detectDelimiter, parseCsv } from './csv'

describe('parseCsv', () => {
  it('lee filas simples con saltos de línea de Windows y de Unix', () => {
    expect(parseCsv('a,b\r\n1,2\n3,4').rows).toEqual([['a', 'b'], ['1', '2'], ['3', '4']])
  })

  it('respeta comillas: comas, saltos de línea y comillas dobles dentro de una celda', () => {
    const { rows } = parseCsv('nombre,nota\n"Queso, seco","dice ""hola""\nsegunda línea"\nPan,')
    expect(rows).toEqual([['nombre', 'nota'], ['Queso, seco', 'dice "hola"\nsegunda línea'], ['Pan', '']])
  })

  it('quita el BOM de Excel y omite líneas vacías (también al final)', () => {
    expect(parseCsv('﻿a,b\n\n1,2\n\n').rows).toEqual([['a', 'b'], ['1', '2']])
  })

  it('una celda entre comillas vacía en una fila de una sola columna sí es una fila', () => {
    expect(parseCsv('a\n""\nb').rows).toEqual([['a'], [''], ['b']])
  })

  it('una comilla sin cerrar no pierde el texto', () => {
    expect(parseCsv('a,b\n1,"sin cerrar\nmás').rows).toEqual([['a', 'b'], ['1', 'sin cerrar\nmás']])
  })

  it('detecta el separador: coma, punto y coma o tabulador', () => {
    expect(detectDelimiter('a,b,c\n1,2,3')).toBe(',')
    expect(detectDelimiter('nombre;precio;costo\nQueso;90,50;60')).toBe(';')
    expect(detectDelimiter('a\tb\tc\n1\t2\t3')).toBe('\t')
    expect(parseCsv('nombre;precio\nQueso;90,50').rows).toEqual([['nombre', 'precio'], ['Queso', '90,50']])
  })

  it('un separador dentro de comillas no cuenta para detectarlo', () => {
    expect(detectDelimiter('"a;b;c";d,e\n1,2')).toBe(',')
  })

  it('texto vacío no da filas', () => {
    expect(parseCsv('').rows).toEqual([])
    expect(parseCsv('\n\n').rows).toEqual([])
  })
})

describe('csvCell', () => {
  it('cita solo cuando hace falta', () => {
    expect(csvCell('Pan')).toBe('Pan')
    expect(csvCell('a,b')).toBe('"a,b"')
    expect(csvCell('di "hola"')).toBe('"di ""hola"""')
  })
})
