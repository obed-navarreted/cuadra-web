import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useFormat } from '../hooks/useFormat'
import { isValidRange, type DateRange, type PresetKey } from '../lib/dates'

const ORDER: PresetKey[] = ['today', 'yesterday', 'last7', 'last30', 'thisMonth', 'lastMonth']

/** Rango de jornadas del negocio: atajos (hoy, 7 días, mes…) o fechas a mano. Solo avisa cuando el rango es válido. */
export function RangePicker({ value, onChange }: { value: DateRange; onChange: (r: DateRange) => void }) {
  const { t } = useTranslation()
  const { presets, today } = useFormat()
  const options = presets(today())
  const [custom, setCustom] = useState(value)
  const active = ORDER.find((k) => options[k].from === value.from && options[k].to === value.to)
  return (
    <div className="range">
      <div className="chips">
        {ORDER.map((k) => (
          <button key={k} type="button" className={`chip${active === k ? ' on' : ''}`} onClick={() => (setCustom(options[k]), onChange(options[k]))}>
            {t(`range.${k}`)}
          </button>
        ))}
      </div>
      <div className="range-custom">
        <label className="field">
          <span className="field-label">{t('shell.from')}</span>
          <input type="date" value={custom.from} onChange={(e) => (setCustom({ ...custom, from: e.target.value }), isValidRange({ ...custom, from: e.target.value }) && onChange({ ...custom, from: e.target.value }))} />
        </label>
        <label className="field">
          <span className="field-label">{t('shell.to')}</span>
          <input type="date" value={custom.to} onChange={(e) => (setCustom({ ...custom, to: e.target.value }), isValidRange({ ...custom, to: e.target.value }) && onChange({ ...custom, to: e.target.value }))} />
        </label>
      </div>
    </div>
  )
}
