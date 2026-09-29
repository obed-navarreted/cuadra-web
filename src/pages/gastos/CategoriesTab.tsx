import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { call, client } from '../../api/http'
import { useBusiness } from '../../auth/context'
import { DataTable, type Column } from '../../components/DataTable'
import { Modal } from '../../components/Modal'
import { Button, ErrorNotice, Field, Tag } from '../../components/ui'
import { categoryLabel } from './logic'
import type { ExpenseCategory } from './types'

/** Categorías de gasto: las de fábrica se pueden renombrar y ocultar; ocultar no borra los gastos ya registrados. */
export function CategoriesTab({ categories, onChanged }: { categories: ExpenseCategory[]; onChanged: () => void }) {
  const { t } = useTranslation('gastos')
  const { business } = useBusiness()
  const businessId = business.id
  const [editing, setEditing] = useState<{ id: string; name: string } | 'new' | null>(null)
  const [name, setName] = useState('')
  const [error, setError] = useState<unknown>(null)
  const [busy, setBusy] = useState(false)
  const label = (c: ExpenseCategory) => categoryLabel(c, (k) => t(`cat.${k}`, { defaultValue: '' }) || null)

  const put = async (id: string, body: { name?: string; active?: boolean }) => {
    setBusy(true)
    setError(null)
    try {
      await call(client.PUT('/api/b/{businessId}/expense-categories/{categoryId}', { params: { path: { businessId, categoryId: id } }, body }))
      onChanged()
      return true
    } catch (e) {
      setError(e)
      return false
    } finally {
      setBusy(false)
    }
  }
  const open = (target: typeof editing, initial = '') => {
    setName(initial)
    setError(null)
    setEditing(target)
  }
  const save = async () => {
    if (!editing || !name.trim()) return
    const ok = editing === 'new' ? await put(crypto.randomUUID(), { name: name.trim() }) : await put(editing.id, { name: name.trim() })
    if (ok) setEditing(null)
  }

  const columns: Column<ExpenseCategory>[] = [
    { key: 'name', header: t('col.category'), cell: (c) => <span>{label(c)} {!c.active && <Tag>{t('categories.hidden')}</Tag>}</span> },
    {
      key: 'act',
      header: t('col.actions'),
      align: 'right',
      cell: (c) => (
        <span className="row" style={{ justifyContent: 'flex-end' }}>
          <Button small onClick={() => open({ id: c.id, name: label(c) }, label(c))}>{t('categories.rename')}</Button>
          <Button small disabled={busy} onClick={() => void put(c.id, { active: !c.active })}>{c.active ? t('categories.hide') : t('categories.show')}</Button>
        </span>
      ),
    },
  ]
  return (
    <>
      <div className="row">
        <p className="muted grow">{t('categories.hint')}</p>
        <Button kind="primary" onClick={() => open('new')}>{t('categories.new')}</Button>
      </div>
      {error != null && editing === null && <ErrorNotice error={error} />}
      <DataTable columns={columns} rows={categories} rowKey={(c) => c.id} empty={t('categories.empty')} />
      <Modal open={editing !== null} title={editing === 'new' ? t('categories.new') : t('categories.rename')} onClose={() => setEditing(null)}>
        <Field label={t('categories.name')}>
          <input value={name} maxLength={60} onChange={(e) => setName(e.target.value)} autoFocus onKeyDown={(e) => e.key === 'Enter' && void save()} />
        </Field>
        {error != null && <ErrorNotice error={error} />}
        <div className="row">
          <Button onClick={() => setEditing(null)}>{t('form.cancel')}</Button>
          <Button kind="primary" disabled={busy || !name.trim()} onClick={() => void save()}>{t('form.save')}</Button>
        </div>
      </Modal>
    </>
  )
}
