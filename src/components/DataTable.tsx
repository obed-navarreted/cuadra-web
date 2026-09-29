import type { ReactNode } from 'react'
import { EmptyState } from './ui'

export type Column<T> = { key: string; header: ReactNode; cell: (row: T) => ReactNode; align?: 'right'; className?: string }

/**
 * Tabla que en pantallas angostas se desplaza a los lados dentro de su propia caja (la página nunca se desborda). Si se pasa `onRowClick`, cada fila
 * es un botón accesible con teclado.
 */
export function DataTable<T>({ columns, rows, rowKey, empty, onRowClick, rowClassName }: { columns: Column<T>[]; rows: T[]; rowKey: (row: T) => string; empty: ReactNode; onRowClick?: (row: T) => void; rowClassName?: (row: T) => string | undefined }) {
  if (rows.length === 0) return <EmptyState>{empty}</EmptyState>
  return (
    <div className="table-wrap">
      <table className="data">
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key} className={c.align === 'right' ? 'right' : undefined} scope="col">
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={rowKey(row)}
              className={[onRowClick ? 'clickable' : '', rowClassName?.(row) ?? ''].filter(Boolean).join(' ') || undefined}
              tabIndex={onRowClick ? 0 : undefined}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              onKeyDown={onRowClick ? (e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onRowClick(row)) : undefined}
            >
              {columns.map((c) => (
                <td key={c.key} className={`${c.align === 'right' ? 'right ' : ''}${c.className ?? ''}`.trim() || undefined} data-label={typeof c.header === 'string' && c.header ? c.header : undefined}>
                  {c.cell(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
