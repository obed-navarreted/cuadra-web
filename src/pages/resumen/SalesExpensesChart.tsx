import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { DataTable } from '../../components/DataTable'
import { Button, EmptyState } from '../../components/ui'
import { useFormat } from '../../hooks/useFormat'
import { decimalsOf } from '../../lib/money'
import { axisLabel, labelEvery, niceScale } from '../reportes/logic'
import type { DayPoint } from '../reportes/types'
import './resumen.css'

const LEFT = 46
const RIGHT = 8
const TOP = 24
const BOTTOM = 34
const HEIGHT = 270
const MIN_PER_DAY = 18

/** Ancho disponible de un elemento (se actualiza al girar el teléfono o cambiar la ventana). En pruebas, sin ResizeObserver, usa un ancho fijo. */
function useWidth() {
  const ref = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(640)
  useEffect(() => {
    const el = ref.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(280, Math.floor(entry.contentRect.width))))
    observer.observe(el)
    setWidth(Math.max(280, Math.floor(el.getBoundingClientRect().width || 640)))
    return () => observer.disconnect()
  }, [])
  return [ref, width] as const
}

/** Barra con las dos esquinas de arriba redondeadas (4 px) y la base pegada al eje. */
function barPath(x: number, w: number, top: number, base: number): string {
  const h = base - top
  const r = Math.min(4, h, w / 2)
  return `M${x},${base} V${top + r} Q${x},${top} ${x + r},${top} H${x + w - r} Q${x + w},${top} ${x + w},${top + r} V${base} Z`
}

/**
 * Ventas y gastos por día: barras agrupadas (izquierda ventas, derecha gastos), un solo eje, cuadrícula discreta, leyenda, `<title>` por barra
 * y una etiqueta directa en el día de más ventas. Cada día es un objetivo que se puede tocar o enfocar con teclado para ver su detalle.
 * La vista de tabla da los mismos números sin depender del color ni de la puntería.
 */
export function SalesExpensesChart({ series }: { series: DayPoint[] }) {
  const { t, i18n } = useTranslation('resumen')
  const { money, day, currency } = useFormat()
  const decimals = decimalsOf(currency)
  const [ref, width] = useWidth()
  const [asTable, setAsTable] = useState(false)
  const [active, setActive] = useState<number | null>(null)

  const total = series.reduce((s, p) => s + p.salesMinor + p.expensesMinor, 0)
  if (series.length === 0 || total === 0) return <EmptyState>{t('chart.empty')}</EmptyState>

  const n = series.length
  const perDay = Math.max(MIN_PER_DAY, Math.floor((width - LEFT - RIGHT) / n))
  const svgWidth = LEFT + RIGHT + perDay * n
  const bar = Math.max(4, Math.min(18, Math.floor((perDay - 6) / 2)))
  const scale = niceScale(Math.max(...series.map((p) => Math.max(p.salesMinor, p.expensesMinor))))
  const y = (v: number) => HEIGHT - BOTTOM - ((HEIGHT - BOTTOM - TOP) * v) / scale.max
  const base = y(0)
  const every = labelEvery(n, perDay)
  const bestIndex = series.reduce((best, p, i) => (p.salesMinor > series[best].salesMinor ? i : best), 0)
  const month = new Intl.DateTimeFormat(i18n.language, { month: 'short', timeZone: 'UTC' })

  const point = (p: DayPoint) => t('chart.point', { day: day(p.date ?? ''), sales: money(p.salesMinor), expenses: money(p.expensesMinor) })
  const shown = active === null ? null : series[active]
  // El detalle va AL LADO de la barra (a la derecha, o a la izquierda si no cabe), para no taparla.
  const center = active === null ? 0 : LEFT + perDay * active + perDay / 2
  const tipLeft = active === null ? 0 : center + perDay / 2 + 8 + 180 <= svgWidth ? center + perDay / 2 + 8 : Math.max(8, center - perDay / 2 - 8 - 180)

  return (
    <div className="chart">
      <div className="chart-head">
        <ul className="legend" aria-label={t('chart.title')}>
          <li>
            <span className="swatch sales" aria-hidden="true" />
            {t('chart.sales')}
          </li>
          <li>
            <span className="swatch expenses" aria-hidden="true" />
            {t('chart.expenses')}
          </li>
        </ul>
        <Button small onClick={() => setAsTable((v) => !v)} aria-pressed={asTable}>
          {asTable ? t('chart.asChart') : t('chart.asTable')}
        </Button>
      </div>
      {asTable ? (
        <DataTable
          columns={[
            { key: 'day', header: t('chart.day'), cell: (p: DayPoint) => day(p.date ?? '') },
            { key: 'sales', header: t('chart.sales'), align: 'right', cell: (p) => money(p.salesMinor) },
            { key: 'expenses', header: t('chart.expenses'), align: 'right', cell: (p) => money(p.expensesMinor) },
          ]}
          rows={series}
          rowKey={(p) => p.date ?? ''}
          empty={t('chart.empty')}
        />
      ) : (
        <div className="chart-scroll" ref={ref}>
          <div className="chart-box" style={{ width: svgWidth }}>
            <svg width={svgWidth} height={HEIGHT} viewBox={`0 0 ${svgWidth} ${HEIGHT}`} role="group" aria-label={t('chart.aria')}>
              {scale.ticks.map((tick) => (
                <g key={tick}>
                  <line className={tick === 0 ? 'axis' : 'grid'} x1={LEFT} x2={svgWidth - RIGHT} y1={y(tick)} y2={y(tick)} />
                  <text className="tick" x={LEFT - 8} y={y(tick) + 4} textAnchor="end">
                    {axisLabel(tick, decimals, i18n.language)}
                  </text>
                </g>
              ))}
              {series.map((p, i) => {
                const x0 = LEFT + perDay * i + (perDay - (2 * bar + 2)) / 2
                const date = p.date ?? ''
                const dom = Number(date.slice(8, 10))
                const showLabel = i % every === 0 || i === n - 1
                return (
                  <g key={date}>
                    {p.salesMinor > 0 && (
                      <path className="bar-sales" d={barPath(x0, bar, y(p.salesMinor), base)}>
                        <title>{`${t('chart.sales')} ${day(date)}: ${money(p.salesMinor)}`}</title>
                      </path>
                    )}
                    {p.expensesMinor > 0 && (
                      <path className="bar-expenses" d={barPath(x0 + bar + 2, bar, y(p.expensesMinor), base)}>
                        <title>{`${t('chart.expenses')} ${day(date)}: ${money(p.expensesMinor)}`}</title>
                      </path>
                    )}
                    {i === bestIndex && p.salesMinor > 0 && (
                      <text className="value-label" x={x0 + bar / 2} y={y(p.salesMinor) - 6} textAnchor="middle">
                        {axisLabel(p.salesMinor, decimals, i18n.language)}
                      </text>
                    )}
                    {showLabel && (
                      <>
                        <text className="tick" x={LEFT + perDay * i + perDay / 2} y={HEIGHT - BOTTOM + 16} textAnchor="middle">
                          {dom}
                        </text>
                        {(i === 0 || dom === 1) && (
                          <text className="tick month" x={LEFT + perDay * i + perDay / 2} y={HEIGHT - BOTTOM + 29} textAnchor="middle">
                            {month.format(new Date(`${date}T00:00:00Z`))}
                          </text>
                        )}
                      </>
                    )}
                    <rect
                      className="hit"
                      x={LEFT + perDay * i}
                      y={TOP - 8}
                      width={perDay}
                      height={HEIGHT - TOP - BOTTOM + 8}
                      tabIndex={0}
                      role="img"
                      aria-label={point(p)}
                      onMouseEnter={() => setActive(i)}
                      onMouseLeave={() => setActive(null)}
                      onFocus={() => setActive(i)}
                      onBlur={() => setActive(null)}
                      onClick={() => setActive(active === i ? null : i)}
                    />
                  </g>
                )
              })}
            </svg>
            {shown && (
              <div className="tooltip" style={{ left: tipLeft }} role="status">
                <strong>{day(shown.date ?? '')}</strong>
                <span>
                  <i className="swatch sales" aria-hidden="true" /> {t('chart.sales')}: {money(shown.salesMinor)}
                </span>
                <span>
                  <i className="swatch expenses" aria-hidden="true" /> {t('chart.expenses')}: {money(shown.expensesMinor)}
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
