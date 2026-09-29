import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useBusiness } from '../../auth/context'
import { DataTable, type Column } from '../../components/DataTable'
import { Modal } from '../../components/Modal'
import { Button, Card, ErrorNotice, Field, Kpi, Spinner, Tag } from '../../components/ui'
import { useAsync } from '../../hooks/useAsync'
import { useFormat } from '../../hooks/useFormat'
import { loadSuppliers, saveSupplier } from './api'
import { errorMessage, newId } from './errors'
import type { SupplierView } from './types'

/** Proveedores (opcionales: una compra puede llevar solo el nombre) y lo que se les debe. */
export function SuppliersTab({ reloadKey, onChanged, onOpenPurchases }: { reloadKey: number; onChanged: () => void; onOpenPurchases: (supplierId: string) => void }) {
  const { t } = useTranslation('inventario')
  const { business } = useBusiness()
  const fmt = useFormat()
  const [editing, setEditing] = useState<SupplierView | 'new' | null>(null)
  const list = useAsync(() => loadSuppliers(business.id), [business.id, reloadKey])
  const owed = (list.data ?? []).reduce((s, x) => s + x.balanceMinor, 0)

  const columns: Column<SupplierView>[] = [
    { key: 'name', header: t('suppliers.col.name'), cell: (s) => <strong>{s.name}</strong> },
    { key: 'phone', header: t('suppliers.col.phone'), cell: (s) => s.phone ?? <span className="muted">—</span> },
    { key: 'balance', header: t('suppliers.col.balance'), align: 'right', cell: (s) => (s.balanceMinor > 0 ? <span className="inv-low">{fmt.money(s.balanceMinor)}</span> : <span className="muted">{fmt.money(0)}</span>) },
    { key: 'state', header: '', cell: (s) => (s.active ? null : <Tag>{t('suppliers.inactive')}</Tag>) },
    {
      key: 'purchases',
      header: '',
      cell: (s) => (
        <Button
          small
          onClick={(e) => {
            e.stopPropagation()
            onOpenPurchases(s.id)
          }}
        >
          {t('suppliers.purchases')}
        </Button>
      ),
    },
  ]

  return (
    <div className="inv-stack">
      <div className="kpis">
        <Kpi label={t('suppliers.owedTotal')} value={fmt.money(owed)} tone={owed > 0 ? 'orange' : 'green'} hint={t('suppliers.owedHint')} />
      </div>
      <Card
        title={t('tabs.suppliers')}
        actions={
          <Button kind="primary" onClick={() => setEditing('new')}>
            {t('suppliers.new')}
          </Button>
        }
      >
        <p className="muted small">{t('suppliers.optional')}</p>
        {list.error ? <ErrorNotice error={list.error} onRetry={list.reload} /> : list.loading && !list.data ? <Spinner /> : <DataTable columns={columns} rows={list.data ?? []} rowKey={(s) => s.id} empty={t('suppliers.empty')} onRowClick={setEditing} />}
      </Card>
      {editing && (
        <SupplierModal
          key={editing === 'new' ? 'new' : editing.id}
          supplier={editing === 'new' ? undefined : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            onChanged()
          }}
        />
      )}
    </div>
  )
}

function SupplierModal({ supplier, onClose, onSaved }: { supplier: SupplierView | undefined; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation('inventario')
  const { business } = useBusiness()
  const [name, setName] = useState(supplier?.name ?? '')
  const [phone, setPhone] = useState(supplier?.phone ?? '')
  const [notes, setNotes] = useState(supplier?.notes ?? '')
  const [active, setActive] = useState(supplier?.active ?? true)
  const [invalid, setInvalid] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const [saving, setSaving] = useState(false)

  const save = async () => {
    if (!name.trim()) return setInvalid(true)
    setInvalid(false)
    setSaving(true)
    setError(null)
    try {
      await saveSupplier(business.id, supplier?.id ?? newId(), { name: name.trim(), phone: phone.trim() || undefined, notes: notes.trim() || undefined, active })
      onSaved()
    } catch (e) {
      setError(e)
      setSaving(false)
    }
  }

  return (
    <Modal open title={supplier ? t('suppliers.editTitle') : t('suppliers.newTitle')} onClose={onClose}>
      <form
        className="inv-form"
        onSubmit={(e) => {
          e.preventDefault()
          void save()
        }}
      >
        <Field label={t('suppliers.col.name')} hint={invalid ? t('problems.name') : undefined}>
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} aria-invalid={invalid} required />
        </Field>
        <Field label={t('suppliers.col.phone')}>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" />
        </Field>
        <Field label={t('suppliers.notes')}>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} />
        </Field>
        {supplier && (
          <label className="inv-check">
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
            <span>{t('suppliers.active')}</span>
          </label>
        )}
        {error !== null && <div className="notice error" role="alert">{errorMessage(t, error)}</div>}
        <div className="inv-actions">
          <span className="grow" />
          <Button onClick={onClose} disabled={saving}>
            {t('cancel')}
          </Button>
          <Button type="submit" kind="primary" disabled={saving}>
            {t('save')}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
