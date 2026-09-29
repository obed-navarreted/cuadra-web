import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useBusiness } from '../../auth/context'
import { DataTable, type Column } from '../../components/DataTable'
import { Modal } from '../../components/Modal'
import { Button, Card, ErrorNotice, Field, Spinner, Tabs, Tag } from '../../components/ui'
import { useAsync } from '../../hooks/useAsync'
import { useFormat } from '../../hooks/useFormat'
import { decimalsOf } from '../../lib/money'
import { deactivateProduct, loadCategories, loadProducts, saveProduct, addMovement } from './api'
import { errorMessage, newId } from './errors'
import { draftFromProduct, emptyDraft, marginPercent, needsReview, toProductInput, type Problem, type ProductDraft } from './productDraft'
import { parseQuantity } from './quantity'
import { UNITS, type Product } from './types'

type Filter = 'all' | 'tracked' | 'untracked' | 'review' | 'noCost'

/**
 * Catálogo de productos. Es independiente del inventario: un producto puede no llevar control de existencia (se vende sin descontar). Con el módulo
 * de inventario apagado la pantalla sigue sirviendo como catálogo y no muestra existencias.
 */
export function ProductsTab({ inventory, reloadKey, onChanged }: { inventory: boolean; reloadKey: number; onChanged: () => void }) {
  const { t } = useTranslation('inventario')
  const { business } = useBusiness()
  const fmt = useFormat()
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [editing, setEditing] = useState<Product | 'new' | null>(null)
  const products = useAsync(() => loadProducts(business.id), [business.id, reloadKey])
  const categories = useAsync(() => loadCategories(business.id), [business.id])
  const categoryName = useMemo(() => new Map((categories.data ?? []).map((c) => [c.id, c.name ?? ''])), [categories.data])

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (products.data ?? []).filter((p) => {
      if (q && !`${p.name} ${p.variant ?? ''} ${p.barcode ?? ''} ${p.shortCode ?? ''}`.toLowerCase().includes(q)) return false
      switch (filter) {
        case 'tracked': return p.trackStock
        case 'untracked': return !p.trackStock
        case 'review': return needsReview(p)
        case 'noCost': return p.costMinor == null
        default: return true
      }
    })
  }, [products.data, query, filter])

  const filters: { key: Filter; label: string }[] = [
    { key: 'all', label: t('products.filter.all') },
    ...(inventory
      ? ([
          { key: 'tracked', label: t('products.filter.tracked') },
          { key: 'untracked', label: t('products.filter.untracked') },
          { key: 'review', label: t('products.filter.review') },
        ] as { key: Filter; label: string }[])
      : []),
    { key: 'noCost', label: t('products.filter.noCost') },
  ]

  const columns: Column<Product>[] = [
    {
      key: 'name',
      header: t('products.col.name'),
      cell: (p) => (
        <div>
          <strong>{p.name}</strong>
          {p.variant && <span className="muted"> · {p.variant}</span>}
          <div className="muted small">{[p.barcode, p.categoryId ? categoryName.get(p.categoryId) : undefined].filter(Boolean).join(' · ')}</div>
        </div>
      ),
    },
    { key: 'price', header: t('products.col.price'), align: 'right', cell: (p) => fmt.money(p.priceMinor) },
    { key: 'cost', header: t('products.col.cost'), align: 'right', cell: (p) => (p.costMinor == null ? <span className="muted">—</span> : fmt.money(p.costMinor)) },
    {
      key: 'margin',
      header: t('products.col.margin'),
      align: 'right',
      cell: (p) => {
        const m = marginPercent(p.priceMinor, p.costMinor)
        return m === null ? <span className="muted">—</span> : `${m}%`
      },
    },
    ...(inventory
      ? [
          {
            key: 'stock',
            header: t('products.col.stock'),
            align: 'right' as const,
            cell: (p: Product) =>
              !p.trackStock ? (
                <Tag>{t('products.untracked')}</Tag>
              ) : (
                <span className={p.stockMilli < 0 ? 'inv-negative' : needsReview(p) ? 'inv-low' : undefined}>
                  {fmt.quantity(p.stockMilli)} {t(`units.${p.unit ?? 'UNIT'}`)}
                </span>
              ),
          },
        ]
      : []),
  ]

  return (
    <div className="inv-stack">
      <Card>
        <div className="inv-toolbar">
          <Field label={t('products.search')}>
            <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} />
          </Field>
          <Button kind="primary" onClick={() => setEditing('new')}>
            {t('products.new')}
          </Button>
        </div>
        <Tabs value={filter} onChange={setFilter} items={filters} />
      </Card>
      {products.error ? (
        <ErrorNotice error={products.error} onRetry={products.reload} />
      ) : products.loading && !products.data ? (
        <Spinner />
      ) : (
        <>
          <p className="muted small">{t('products.count', { count: rows.length })}</p>
          <DataTable columns={columns} rows={rows} rowKey={(p) => p.id} empty={t('products.empty')} onRowClick={(p) => setEditing(p)} />
        </>
      )}
      {editing && (
        <ProductModal
          key={editing === 'new' ? 'new' : editing.id}
          product={editing === 'new' ? undefined : editing}
          inventory={inventory}
          categories={categories.data ?? []}
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

const PROBLEM_KEY: Record<Problem, string> = { name: 'name', price: 'price', cost: 'cost', minStock: 'minStock', initialStock: 'initialStock' }

function ProductModal({ product, inventory, categories, onClose, onSaved }: { product: Product | undefined; inventory: boolean; categories: { id: string; name?: string | null; key?: string | null }[]; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation('inventario')
  const { business } = useBusiness()
  const currency = business.currency ?? 'USD'
  const [draft, setDraft] = useState<ProductDraft>(() => (product ? draftFromProduct(product, decimalsOf(currency)) : emptyDraft()))
  const [problems, setProblems] = useState<Problem[]>([])
  const [error, setError] = useState<unknown>(null)
  const [saving, setSaving] = useState(false)
  const [confirmOff, setConfirmOff] = useState(false)
  const set = <K extends keyof ProductDraft>(k: K, v: ProductDraft[K]) => setDraft((d) => ({ ...d, [k]: v }))
  const bad = (p: Problem) => problems.includes(p)

  const save = async () => {
    const { input, problems: found } = toProductInput(draft, currency, product, inventory)
    setProblems(found)
    if (!input) return
    setSaving(true)
    setError(null)
    try {
      const id = product?.id ?? newId()
      await saveProduct(business.id, id, input)
      // Al empezar a llevar control se puede dar de una vez el conteo inicial.
      const initial = parseQuantity(draft.initialStock)
      if (inventory && input.trackStock && !product?.trackStock && initial !== null) {
        await addMovement(business.id, newId(), { productId: id, kind: 'INITIAL', countedMilli: initial })
      }
      onSaved()
    } catch (e) {
      setError(e)
      setSaving(false)
    }
  }

  const deactivate = async () => {
    if (!product) return
    setSaving(true)
    try {
      await deactivateProduct(business.id, product.id)
      onSaved()
    } catch (e) {
      setError(e)
      setSaving(false)
    }
  }

  return (
    <Modal open title={product ? t('form.editTitle') : t('form.newTitle')} onClose={onClose}>
      <form
        className="inv-form"
        onSubmit={(e) => {
          e.preventDefault()
          void save()
        }}
      >
        <Field label={t('form.name')}>
          <input value={draft.name} onChange={(e) => set('name', e.target.value)} aria-invalid={bad('name')} required />
        </Field>
        <div className="inv-cols">
          <Field label={t('form.variant')}>
            <input value={draft.variant} onChange={(e) => set('variant', e.target.value)} />
          </Field>
          <Field label={t('form.category')}>
            <select value={draft.categoryId} onChange={(e) => set('categoryId', e.target.value)}>
              <option value="">{t('form.noCategory')}</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name ?? c.key}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <div className="inv-cols">
          <Field label={t('form.barcode')}>
            <input value={draft.barcode} onChange={(e) => set('barcode', e.target.value)} inputMode="numeric" />
          </Field>
          <Field label={t('form.shortCode')}>
            <input value={draft.shortCode} onChange={(e) => set('shortCode', e.target.value)} />
          </Field>
        </div>
        <div className="inv-cols">
          <Field label={t('form.unit')}>
            <select value={draft.unit} onChange={(e) => set('unit', e.target.value)}>
              {UNITS.map((u) => (
                <option key={u} value={u}>
                  {t(`units.${u}`)}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t('form.pricing')}>
            <select value={draft.pricing} onChange={(e) => set('pricing', e.target.value as ProductDraft['pricing'])}>
              <option value="FIXED">{t('form.pricingFixed')}</option>
              <option value="BY_WEIGHT">{t('form.pricingByWeight')}</option>
            </select>
          </Field>
        </div>
        <div className="inv-cols">
          <Field label={t('form.price')} hint={bad('price') ? t('problems.amount') : undefined}>
            <input value={draft.price} onChange={(e) => set('price', e.target.value)} inputMode="decimal" aria-invalid={bad('price')} required />
          </Field>
          <Field label={t('form.cost')} hint={bad('cost') ? t('problems.amount') : t('form.costHint')}>
            <input value={draft.cost} onChange={(e) => set('cost', e.target.value)} inputMode="decimal" aria-invalid={bad('cost')} />
          </Field>
        </div>
        <label className="inv-check">
          <input type="checkbox" checked={draft.isQuick} onChange={(e) => set('isQuick', e.target.checked)} />
          <span>{t('form.quick')}</span>
        </label>
        {inventory && (
          <>
            <label className="inv-check">
              <input type="checkbox" checked={draft.trackStock} onChange={(e) => set('trackStock', e.target.checked)} />
              <span>
                <strong>{t('form.track')}</strong>
                <span className="muted small"> — {t('form.trackHint')}</span>
              </span>
            </label>
            {draft.trackStock && (
              <div className="inv-cols">
                <Field label={t('form.minStock')} hint={bad('minStock') ? t('problems.quantity') : undefined}>
                  <input value={draft.minStock} onChange={(e) => set('minStock', e.target.value)} inputMode="decimal" aria-invalid={bad('minStock')} />
                </Field>
                {!product?.trackStock && (
                  <Field label={t('form.initialStock')} hint={bad('initialStock') ? t('problems.quantity') : t('form.initialStockHint')}>
                    <input value={draft.initialStock} onChange={(e) => set('initialStock', e.target.value)} inputMode="decimal" aria-invalid={bad('initialStock')} />
                  </Field>
                )}
              </div>
            )}
          </>
        )}
        {problems.length > 0 && <div className="notice error" role="alert">{t('problems.summary', { fields: problems.map((p) => t(`form.${PROBLEM_KEY[p]}`)).join(', ') })}</div>}
        {error !== null && <div className="notice error" role="alert">{errorMessage(t, error)}</div>}
        <div className="inv-actions">
          {product && (
            <Button kind={confirmOff ? 'danger' : 'plain'} onClick={() => (confirmOff ? void deactivate() : setConfirmOff(true))} disabled={saving}>
              {confirmOff ? t('form.deactivateConfirm') : t('form.deactivate')}
            </Button>
          )}
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
