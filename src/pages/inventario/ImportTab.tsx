import { useMemo, useState, type ChangeEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useBusiness } from '../../auth/context'
import { DataTable, type Column } from '../../components/DataTable'
import { Modal } from '../../components/Modal'
import { Button, Card, Field, Kpi, Spinner, Tag } from '../../components/ui'
import { importProducts } from './api'
import { csvCell, parseCsv, type Delimiter } from './csv'
import { errorMessage } from './errors'
import { buildRows, FIELDS, guessMapping, MAX_ROWS, STOCK_FIELDS, TEMPLATE_ROWS, type Field as ImportField, type Mapping } from './importMapping'
import type { ImportResult, ImportRowResult } from './types'

/**
 * Importar productos y existencias desde un CSV. El archivo se lee AQUÍ (en el navegador) y el servidor valida cada fila con las mismas reglas que un
 * producto normal. Siempre hay una vista previa que no guarda nada; solo después se puede aplicar. Reimportar el mismo archivo actualiza, no duplica.
 */
export function ImportTab({ inventory, onChanged }: { inventory: boolean; onChanged: () => void }) {
  const { t } = useTranslation('inventario')
  const { business } = useBusiness()
  const allowed = useMemo(() => (inventory ? FIELDS : FIELDS.filter((f) => !STOCK_FIELDS.includes(f))), [inventory])
  const [text, setText] = useState('')
  const [fileName, setFileName] = useState('')
  const [delimiter, setDelimiter] = useState<Delimiter | undefined>(undefined)
  const [mapping, setMapping] = useState<Mapping>([])
  const [preview, setPreview] = useState<ImportResult | null>(null)
  const [applied, setApplied] = useState<ImportResult | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const [confirming, setConfirming] = useState(false)

  const parsed = useMemo(() => (text.trim() ? parseCsv(text, delimiter) : null), [text, delimiter])
  const header = parsed?.rows[0] ?? []
  const data = useMemo(() => parsed?.rows.slice(1) ?? [], [parsed])
  const rows = useMemo(() => buildRows(data, mapping), [data, mapping])
  const nameMapped = mapping.includes('name')
  const tooMany = rows.length > MAX_ROWS

  const load = (content: string, name: string) => {
    setText(content)
    setFileName(name)
    setDelimiter(undefined)
    setPreview(null)
    setApplied(null)
    setError(null)
    const p = content.trim() ? parseCsv(content) : null
    setMapping(p ? guessMapping(p.rows[0] ?? [], allowed) : [])
  }

  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) load(await file.text(), file.name)
    e.target.value = ''
  }

  const setColumn = (col: number, field: ImportField | null) => {
    // Un campo va en una sola columna: al asignarlo a otra, la anterior se ignora.
    setMapping((m) => m.map((f, i) => (i === col ? field : f === field ? null : f)))
    setPreview(null)
  }

  const run = async (dryRun: boolean) => {
    setBusy(true)
    setError(null)
    try {
      const result = await importProducts(business.id, rows, dryRun)
      if (dryRun) setPreview(result)
      else {
        setApplied(result)
        setPreview(null)
        onChanged()
      }
    } catch (e) {
      setError(e)
    } finally {
      setBusy(false)
      setConfirming(false)
    }
  }

  const downloadTemplate = () => {
    const head = allowed.map((f) => t(`import.field.${f}`))
    const idx = allowed.map((f) => FIELDS.indexOf(f))
    const body = TEMPLATE_ROWS.map((r) => idx.map((i) => r[i]))
    const csv = '﻿' + [head, ...body].map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n'
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url
    a.download = t('import.templateName')
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  const resultColumns: Column<ImportRowResult>[] = [
    { key: 'line', header: t('import.line'), cell: (r) => r.line },
    { key: 'name', header: t('products.col.name'), cell: (r) => r.name },
    {
      key: 'status',
      header: t('import.result'),
      cell: (r) =>
        r.status === 'ERROR' ? (
          <Tag tone="red">{t(`import.code.${r.code ?? 'INTERNAL_ERROR'}`, { defaultValue: r.code })}</Tag>
        ) : (
          <Tag tone={r.status === 'CREATE' ? 'green' : 'neutral'}>{t(`import.status.${r.status ?? 'CREATE'}`)}</Tag>
        ),
    },
  ]

  const summary = (r: ImportResult, done = false) => (
    <div className="kpis">
      <Kpi label={t(done ? 'import.doneCreated' : 'import.created')} value={r.summary?.created ?? 0} tone="green" />
      <Kpi label={t(done ? 'import.doneUpdated' : 'import.updated')} value={r.summary?.updated ?? 0} />
      <Kpi label={t('import.failed')} value={r.summary?.failed ?? 0} tone={(r.summary?.failed ?? 0) > 0 ? 'red' : undefined} hint={t('import.failedHint')} />
    </div>
  )

  return (
    <div className="inv-stack">
      <Card title={t('import.title')}>
        <p className="muted">{t('import.intro', { max: MAX_ROWS })}</p>
        <div className="inv-toolbar">
          <Field label={t('import.file')}>
            <input type="file" accept=".csv,.txt,text/csv,text/plain" onChange={(e) => void onFile(e)} />
          </Field>
          <Button onClick={downloadTemplate}>{t('import.template')}</Button>
        </div>
        <Field label={t('import.paste')} hint={fileName ? t('import.loaded', { name: fileName }) : undefined}>
          <textarea value={text} onChange={(e) => load(e.target.value, '')} rows={5} spellCheck={false} />
        </Field>
      </Card>

      {parsed && (
        <Card title={t('import.mapTitle')}>
          <p className="muted small">{t('import.mapHint', { rows: data.length, delimiter: t(`import.delimiter.${parsed.delimiter === '\t' ? 'tab' : parsed.delimiter === ';' ? 'semicolon' : 'comma'}`) })}</p>
          <div className="inv-map">
            {header.map((h, col) => (
              <div className="inv-map-row" key={col}>
                <div className="grow">
                  <strong>{h || t('import.unnamed', { n: col + 1 })}</strong>
                  <div className="muted small inv-sample">{data.slice(0, 2).map((r) => r[col]).filter(Boolean).join(' · ')}</div>
                </div>
                <label className="field">
                  <span className="field-label">{t('import.maps')}</span>
                  <select value={mapping[col] ?? ''} onChange={(e) => setColumn(col, (e.target.value || null) as ImportField | null)}>
                    <option value="">{t('import.ignore')}</option>
                    {allowed.map((f) => (
                      <option key={f} value={f}>
                        {t(`import.field.${f}`)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            ))}
          </div>
          {!nameMapped && <div className="notice warn" role="alert">{t('import.needName')}</div>}
          {tooMany && <div className="notice error" role="alert">{t('import.tooMany', { max: MAX_ROWS, rows: rows.length })}</div>}
          {nameMapped && !mapping.includes('price') && <div className="notice warn">{t('import.noPrice')}</div>}
          {error !== null && <div className="notice error" role="alert">{errorMessage(t, error)}</div>}
          <div className="inv-actions">
            <span className="muted small grow">{t('import.rowsReady', { count: rows.length })}</span>
            <Button kind="dark" onClick={() => void run(true)} disabled={busy || !nameMapped || rows.length === 0 || tooMany}>
              {t('import.preview')}
            </Button>
          </div>
        </Card>
      )}

      {busy && <Spinner />}

      {preview && (
        <Card title={t('import.previewTitle')}>
          <div className="notice warn">{t('import.previewNote')}</div>
          {summary(preview)}
          <DataTable columns={resultColumns} rows={preview.rows ?? []} rowKey={(r) => String(r.line)} empty={t('import.noRows')} />
          <div className="inv-actions">
            <span className="grow muted small">{t('import.willApply', { count: (preview.summary?.created ?? 0) + (preview.summary?.updated ?? 0) })}</span>
            <Button kind="primary" onClick={() => setConfirming(true)} disabled={busy || (preview.summary?.created ?? 0) + (preview.summary?.updated ?? 0) === 0}>
              {t('import.apply')}
            </Button>
          </div>
        </Card>
      )}

      {applied && (
        <Card title={t('import.doneTitle')} tone={(applied.summary?.failed ?? 0) > 0 ? 'orange' : 'green'}>
          {summary(applied, true)}
          {(applied.summary?.failed ?? 0) > 0 && <DataTable columns={resultColumns} rows={(applied.rows ?? []).filter((r) => r.status === 'ERROR')} rowKey={(r) => String(r.line)} empty="" />}
        </Card>
      )}

      <Modal open={confirming} title={t('import.confirmTitle')} onClose={() => setConfirming(false)}>
        <p>{t('import.confirmBody', { count: (preview?.summary?.created ?? 0) + (preview?.summary?.updated ?? 0) })}</p>
        <div className="inv-actions">
          <span className="grow" />
          <Button onClick={() => setConfirming(false)}>{t('cancel')}</Button>
          <Button kind="primary" onClick={() => void run(false)} disabled={busy}>
            {t('import.apply')}
          </Button>
        </div>
      </Modal>
    </div>
  )
}
