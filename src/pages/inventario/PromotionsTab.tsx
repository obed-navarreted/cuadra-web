import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useBusiness } from '../../auth/context'
import { DataTable, type Column } from '../../components/DataTable'
import { Modal } from '../../components/Modal'
import { Button, Card, ErrorNotice, Field, Spinner, Tag } from '../../components/ui'
import { useAsync } from '../../hooks/useAsync'
import { useFormat } from '../../hooks/useFormat'
import { decimalsOf } from '../../lib/money'
import { deletePromotion, loadProducts, loadPromotions, savePromotion, setPromotionActive } from './api'
import { errorMessage, newId } from './errors'
import { addProduct, byCode, draftFromPromotion, eligible, emptyPromotion, example, toPromotionInput, type PromotionDraft, type PromotionProblem } from './promotionDraft'
import type { Product, Promotion } from './types'

const STATE_TONE: Record<string, 'green' | 'orange' | 'neutral'> = { ACTIVE: 'green', SCHEDULED: 'orange', PAUSED: 'neutral', ENDED: 'neutral' }

/**
 * Productos › Promociones (dueño y admins): «3 por C$ 100» sobre uno o varios productos. La caja las aplica sola (también sin conexión); pausar o cambiar una
 * aquí llega a los teléfonos al sincronizar (al instante con los avisos de Firebase).
 */
export function PromotionsTab({ reloadKey }: { reloadKey: number }) {
  const { t } = useTranslation('inventario')
  const { business } = useBusiness()
  const fmt = useFormat()
  const promotions = useAsync(() => loadPromotions(business.id), [business.id, reloadKey])
  const products = useAsync(() => loadProducts(business.id), [business.id, reloadKey])
  const [editing, setEditing] = useState<Promotion | 'new' | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<unknown>(null)
  const names = useMemo(() => new Map((products.data ?? []).map((p) => [p.id, p.name])), [products.data])

  const toggle = async (p: Promotion) => {
    setBusy(p.id)
    setError(null)
    try {
      await setPromotionActive(business.id, p.id, !p.active)
      promotions.reload()
    } catch (e) {
      setError(e)
    } finally {
      setBusy(null)
    }
  }

  const columns: Column<Promotion>[] = [
    {
      key: 'name',
      header: t('promotions.col.name'),
      cell: (p) => (
        <div>
          <strong>{p.name}</strong>
          <div className="muted small">{(p.productIds ?? []).map((id) => names.get(id) ?? '-').join(', ')}</div>
        </div>
      ),
    },
    { key: 'rule', header: t('promotions.col.rule'), cell: (p) => t('promotions.rule', { quantity: p.quantity, price: fmt.money(p.priceMinor) }) },
    {
      key: 'dates',
      header: t('promotions.col.dates'),
      cell: (p) => (p.startsOn || p.endsOn ? [p.startsOn && t('promotions.from', { day: fmt.day(p.startsOn) }), p.endsOn && t('promotions.until', { day: fmt.day(p.endsOn) })].filter(Boolean).join(' · ') : <span className="muted">{t('promotions.always')}</span>),
    },
    { key: 'state', header: t('promotions.col.state'), cell: (p) => <Tag tone={STATE_TONE[p.state ?? ''] ?? 'neutral'}>{t(`promotions.state.${p.state ?? ''}`, { defaultValue: p.state ?? '' })}</Tag> },
    {
      key: 'action',
      header: '',
      align: 'right',
      cell: (p) => (
        <Button
          small
          onClick={(e) => {
            e.stopPropagation()
            void toggle(p)
          }}
          disabled={busy === p.id}
        >
          {p.active ? t('promotions.pause') : t('promotions.resume')}
        </Button>
      ),
    },
  ]

  return (
    <div className="inv-stack">
      <Card>
        <div className="inv-toolbar">
          <p className="muted grow">{t('promotions.intro')}</p>
          <Button kind="primary" onClick={() => setEditing('new')}>
            {t('promotions.new')}
          </Button>
        </div>
      </Card>
      {error !== null && <div className="notice error" role="alert">{errorMessage(t, error)}</div>}
      {promotions.error ? (
        <ErrorNotice error={promotions.error} onRetry={promotions.reload} />
      ) : promotions.loading && !promotions.data ? (
        <Spinner />
      ) : (
        <DataTable columns={columns} rows={promotions.data ?? []} rowKey={(p) => p.id} empty={t('promotions.empty')} onRowClick={(p) => setEditing(p)} />
      )}
      {editing && (
        <PromotionModal
          key={editing === 'new' ? 'new' : editing.id}
          promotion={editing === 'new' ? undefined : editing}
          products={products.data ?? []}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            promotions.reload()
          }}
        />
      )}
    </div>
  )
}

const PROBLEM_FIELD: Record<PromotionProblem, string> = { name: 'name', quantity: 'quantity', price: 'price', products: 'products', dates: 'dates' }

function PromotionModal({ promotion, products, onClose, onSaved }: { promotion: Promotion | undefined; products: Product[]; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation('inventario')
  const { business } = useBusiness()
  const fmt = useFormat()
  const currency = business.currency ?? 'USD'
  const [draft, setDraft] = useState<PromotionDraft>(() => (promotion ? draftFromPromotion(promotion, decimalsOf(currency)) : emptyPromotion()))
  const [problems, setProblems] = useState<PromotionProblem[]>([])
  const [error, setError] = useState<unknown>(null)
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [query, setQuery] = useState('')
  const [code, setCode] = useState('')
  const [notice, setNotice] = useState<{ text: string; tone: 'green' | 'orange' | 'red' } | null>(null)
  const set = <K extends keyof PromotionDraft>(k: K, v: PromotionDraft[K]) => setDraft((d) => ({ ...d, [k]: v }))
  const bad = (p: PromotionProblem) => problems.includes(p)
  const byId = useMemo(() => new Map(products.map((p) => [p.id, p])), [products])
  const chosen = draft.productIds.map((id) => byId.get(id)).filter((p): p is Product => !!p)
  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    return products.filter((p) => eligible(p) && `${p.name} ${p.variant ?? ''} ${p.barcode ?? ''} ${p.shortCode ?? ''}`.toLowerCase().includes(q)).slice(0, 12)
  }, [products, query])
  const ex = example(draft, currency, chosen.map((p) => p.priceMinor))

  const add = (p: Product) => {
    const r = addProduct(draft.productIds, p)
    set('productIds', r.ids)
    setNotice(
      r.outcome === 'added' ? { text: t('promotions.added', { name: p.name }), tone: 'green' } : r.outcome === 'already' ? { text: t('promotions.already', { name: p.name }), tone: 'orange' } : { text: t('promotions.notEligible', { name: p.name }), tone: 'orange' },
    )
  }

  /** Un lector de códigos (teclado) escribe el código y Enter: agrega el producto y deja el campo listo para el siguiente. */
  const addCode = () => {
    const p = byCode(products, code)
    if (p) add(p)
    else if (code.trim()) setNotice({ text: t('promotions.unknownCode', { code: code.trim() }), tone: 'red' })
    setCode('')
  }

  const save = async () => {
    const { input, problems: found } = toPromotionInput(draft, currency)
    setProblems(found)
    if (!input) return
    setSaving(true)
    setError(null)
    try {
      await savePromotion(business.id, promotion?.id ?? newId(), input)
      onSaved()
    } catch (e) {
      setError(e)
      setSaving(false)
    }
  }

  const remove = async () => {
    if (!promotion) return
    setSaving(true)
    setError(null)
    try {
      await deletePromotion(business.id, promotion.id)
      onSaved()
    } catch (e) {
      setError(e)
      setSaving(false)
      setConfirmDelete(false)
    }
  }

  return (
    <Modal open title={promotion ? t('promotions.editTitle') : t('promotions.newTitle')} onClose={onClose}>
      <form
        className="inv-form"
        onSubmit={(e) => {
          e.preventDefault()
          void save()
        }}
      >
        <Field label={t('promotions.form.name')} hint={bad('name') ? t('promotions.problems.name') : t('promotions.form.nameHint')}>
          <input value={draft.name} onChange={(e) => set('name', e.target.value)} maxLength={80} aria-invalid={bad('name')} required />
        </Field>
        <div className="inv-cols">
          <Field label={t('promotions.form.quantity')} hint={bad('quantity') ? t('promotions.problems.quantity') : undefined}>
            <input value={draft.quantity} onChange={(e) => set('quantity', e.target.value.replace(/\D/g, '').slice(0, 3))} inputMode="numeric" aria-invalid={bad('quantity')} />
          </Field>
          <Field label={t('promotions.form.price')} hint={bad('price') ? t('problems.amount') : undefined}>
            <input value={draft.price} onChange={(e) => set('price', e.target.value)} inputMode="decimal" aria-invalid={bad('price')} />
          </Field>
        </div>
        {ex && (
          <p className={ex.noBenefit ? 'notice warn' : 'notice ok'} role="status">
            {t('promotions.example', { units: ex.units, unit: fmt.money(ex.unitMinor), total: fmt.money(ex.totalMinor) })}
            {ex.noBenefit && ` ${t('promotions.noBenefit')}`}
          </p>
        )}
        <label className="inv-check">
          <input type="checkbox" checked={draft.active} onChange={(e) => set('active', e.target.checked)} />
          <span>
            <strong>{t('promotions.form.active')}</strong>
            <span className="muted small"> ({t('promotions.form.activeHint')})</span>
          </span>
        </label>
        <div className="inv-cols">
          <Field label={t('promotions.form.startsOn')} hint={bad('dates') ? t('promotions.problems.dates') : t('promotions.form.datesHint')}>
            <input type="date" value={draft.startsOn} onChange={(e) => set('startsOn', e.target.value)} aria-invalid={bad('dates')} />
          </Field>
          <Field label={t('promotions.form.endsOn')}>
            <input type="date" value={draft.endsOn} onChange={(e) => set('endsOn', e.target.value)} aria-invalid={bad('dates')} />
          </Field>
        </div>
        <fieldset className="inv-pricing">
          <legend className="field-label">{t('promotions.form.products', { count: chosen.length })}</legend>
          <p className="muted small">{t('promotions.form.productsHint')}</p>
          <div className="inv-cols">
            <Field label={t('promotions.form.search')}>
              <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} />
            </Field>
            <Field label={t('promotions.form.code')} hint={t('promotions.form.codeHint')}>
              <input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    addCode()
                  }
                }}
                autoComplete="off"
                aria-label={t('promotions.form.code')}
              />
            </Field>
          </div>
          {notice && (
            <p className={`notice ${notice.tone === 'green' ? 'ok' : notice.tone === 'red' ? 'error' : 'warn'}`} role="status">
              {notice.text}
            </p>
          )}
          {query.trim() && (
            <ul className="promo-results">
              {results.length === 0 && <li className="muted">{t('promotions.noResults')}</li>}
              {results.map((p) => (
                <li key={p.id}>
                  <button type="button" className="btn small" onClick={() => add(p)} aria-pressed={draft.productIds.includes(p.id)}>
                    {draft.productIds.includes(p.id) ? '✓ ' : '+ '}
                    {p.name}
                    {p.variant ? ` · ${p.variant}` : ''} · {fmt.money(p.priceMinor)}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {bad('products') && <p className="notice error" role="alert">{t('promotions.problems.products')}</p>}
          <ul className="promo-chosen" aria-label={t('promotions.form.products', { count: chosen.length })}>
            {chosen.map((p) => (
              <li key={p.id}>
                <span className="grow">
                  {p.name}
                  {p.variant ? ` · ${p.variant}` : ''} <span className="muted small">{fmt.money(p.priceMinor)}</span>
                </span>
                <Button small onClick={() => set('productIds', draft.productIds.filter((id) => id !== p.id))} aria-label={t('promotions.remove', { name: p.name })}>
                  ✕
                </Button>
              </li>
            ))}
          </ul>
        </fieldset>
        {problems.length > 0 && <div className="notice error" role="alert">{t('promotions.problems.summary', { fields: problems.map((p) => t(`promotions.field.${PROBLEM_FIELD[p]}`)).join(', ') })}</div>}
        {error !== null && <div className="notice error" role="alert">{errorMessage(t, error)}</div>}
        <div className="inv-actions">
          {promotion && (
            <Button kind={confirmDelete ? 'danger' : 'plain'} onClick={() => (confirmDelete ? void remove() : setConfirmDelete(true))} disabled={saving}>
              {confirmDelete ? t('promotions.deleteConfirm') : t('promotions.delete')}
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
