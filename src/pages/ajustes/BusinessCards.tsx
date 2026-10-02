import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { ApiError, call, client } from '../../api/http'
import { useAuth, useBusiness } from '../../auth/context'
import { Modal } from '../../components/Modal'
import { Button, Card, Field } from '../../components/ui'
import { useAsync } from '../../hooks/useAsync'
import { useFormat } from '../../hooks/useFormat'
import { formatHm } from '../../lib/dates'
import { errorText } from '../../lib/errors'
import { dstCutoffTip, sinceForever, timezoneOptions } from './dayRule'
import { formOf, moduleOn, MODULES, patchOf, POS_VIEWS, validateForm, type Form, type UpdateBusiness } from './settings'

/** Guarda un cambio parcial del negocio y recarga el negocio para que todo el panel vea lo nuevo. */
function useSaver() {
  const { t } = useTranslation('ajustes')
  const { membership } = useBusiness()
  const { reloadBusiness } = useAuth()
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null)
  // Apagar «Cobro en caja» con cuentas por cobrar: el servidor pide confirmar antes de anularlas (ADR 0015).
  const [queue, setQueue] = useState<{ count: number; totalMinor: number } | null>(null)
  async function save(body: UpdateBusiness): Promise<boolean> {
    setSaving(true)
    setMessage(null)
    try {
      await call(client.PUT('/api/b/{businessId}', { params: { path: { businessId: membership.businessId ?? '' } }, body }))
      await reloadBusiness()
      setMessage({ tone: 'ok', text: t('saved') })
      return true
    } catch (e) {
      if (e instanceof ApiError && e.code === 'REGISTER_QUEUE_NOT_EMPTY') {
        setQueue({ count: e.count ?? 0, totalMinor: e.totalMinor ?? 0 })
        return false
      }
      setMessage({ tone: 'error', text: e instanceof ApiError ? t(`err.${e.code}`, { defaultValue: errorText(t, e) }) : errorText(t, e) })
      return false
    } finally {
      setSaving(false)
    }
  }
  return { saving, message, save, queue, dismissQueue: () => setQueue(null), clear: () => setMessage(null) }
}

function Notice({ message }: { message: { tone: 'ok' | 'error'; text: string } | null }) {
  if (!message) return null
  return (
    <p className={`notice ${message.tone === 'ok' ? 'aj-ok' : 'error'}`} role={message.tone === 'ok' ? 'status' : 'alert'}>
      {message.text}
    </p>
  )
}

function Switch({ label, hint, checked, disabled, onChange }: { label: string; hint?: string; checked: boolean; disabled?: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="aj-switch">
      <span>
        {label}
        {hint && <span className="muted small" style={{ display: 'block' }}>{hint}</span>}
      </span>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
    </label>
  )
}

function Readonly({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="aj-readonly">
      <span>{label}</span>
      <span>{children}</span>
    </div>
  )
}

/**
 * Las tarjetas de ajustes del negocio. Editar el negocio es del dueño (el servidor lo exige igual): un admin ve los valores pero no los cambia.
 * Cada tarjeta guarda lo suyo y manda solo los campos que cambiaron.
 */
export function BusinessCards() {
  const { t, i18n } = useTranslation('ajustes')
  const { canUsePanel } = useAuth()
  const { business } = useBusiness()
  const { day, money } = useFormat()
  const currency = business.currency ?? 'USD'
  const [form, setForm] = useState<Form>(() => formOf(business))
  const [tried, setTried] = useState(false)
  const data = useSaver()
  const modules = useSaver()
  const error = validateForm(form, currency)
  const patch = patchOf(form, business)
  const dirty = Object.keys(patch).length > 0
  const dayRuleChanged = canUsePanel && (patch.timezone !== undefined || patch.dayCutoff !== undefined)
  const dstTip = canUsePanel && dstCutoffTip(form.timezone, form.dayCutoff)
  const rules = [...(business.dayRules ?? [])].sort((a, b) => (b.from ?? '').localeCompare(a.from ?? ''))
  const pending = business.dayRuleEffectiveFrom ? rules.find((r) => r.from === business.dayRuleEffectiveFrom) : undefined
  const set = (p: Partial<Form>) => (data.clear(), setTried(false), setForm((f) => ({ ...f, ...p })))
  const countries = useAsync(() => call(client.GET('/api/config/countries')), [])
  const countryList = countries.data ?? []
  const locked = business.currencyLocked === true
  // Elegir el país sugiere su moneda (mientras todavía se pueda cambiar).
  const pickCountry = (code: string) => {
    const c = countryList.find((x) => x.code === code)
    set(locked || !c?.currency ? { country: code } : { country: code, currency: c.currency })
  }

  async function submit() {
    setTried(true)
    if (error || !dirty) return
    if (await data.save(patch)) setTried(false)
  }
  async function confirmDiscard() {
    data.dismissQueue()
    if (await data.save({ ...patch, confirmDiscardPending: true })) setTried(false)
  }

  // Una sola barra de guardado para todo el formulario: aparece cuando hay cambios y se queda fija abajo (también en el celular).
  const showBar = canUsePanel && (dirty || data.message != null)
  const saveBar = showBar && (
    <div className="aj-savebar" role="region" aria-label={t('unsaved')}>
      {dirty ? <strong className="grow">{t('unsaved')}</strong> : <span className="grow" />}
      {tried && error && <span className="notice error">{t(`formError.${error}`)}</span>}
      {!(tried && error) && <Notice message={data.message} />}
      {dirty && (
        <>
          <Button disabled={data.saving} onClick={() => (setForm(formOf(business)), setTried(false), data.clear())}>
            {t('discard')}
          </Button>
          <Button kind="primary" disabled={data.saving} onClick={() => void submit()}>
            {t('saveChanges')}
          </Button>
        </>
      )}
    </div>
  )

  return (
    <>
      {!canUsePanel && <p className="notice warn">{t('ownerOnly')}</p>}
      <Card title={t('business.title')}>
        <div className="aj-grid">
          <Field label={t('business.name')}>
            <input value={form.name} disabled={!canUsePanel} maxLength={120} onChange={(e) => set({ name: e.target.value })} />
          </Field>
          <Field label={t('business.type')} hint={t('business.typeHint')}>
            <input value={form.type} disabled={!canUsePanel} onChange={(e) => set({ type: e.target.value })} />
          </Field>
          <Field label={t('business.locale')}>
            <select value={form.defaultLocale} disabled={!canUsePanel} onChange={(e) => set({ defaultLocale: e.target.value })}>
              <option value="es">{t('common:language.es')}</option>
              <option value="en">{t('common:language.en')}</option>
            </select>
          </Field>
          <Field label={t('business.timezone')}>
            <select value={form.timezone} disabled={!canUsePanel} onChange={(e) => set({ timezone: e.target.value })}>
              {timezoneOptions(form.timezone).map((z) => (
                <option key={z} value={z}>
                  {z}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t('business.cutoff')} hint={t('business.cutoffHint')}>
            <input type="time" value={form.dayCutoff} disabled={!canUsePanel} onChange={(e) => set({ dayCutoff: e.target.value })} />
          </Field>
          <Field label={t('business.country')} hint={t('business.countryHint')}>
            <select value={form.country} disabled={!canUsePanel} onChange={(e) => pickCountry(e.target.value)}>
              {!countryList.some((c) => c.code === form.country) && <option value={form.country}>{form.country}</option>}
              {countryList.map((c) => (
                <option key={c.code} value={c.code ?? ''}>
                  {countryName(c.code ?? '', i18n.language)}
                </option>
              ))}
            </select>
          </Field>
          {locked || !canUsePanel ? (
            <Readonly label={t('business.currency')}>
              {currency}
              {locked && <span className="muted small" style={{ display: 'block' }}>{t('business.currencyLocked')}</span>}
            </Readonly>
          ) : (
            <Field label={t('business.currency')} hint={t('business.currencyHint')}>
              <input value={form.currency} maxLength={3} onChange={(e) => set({ currency: e.target.value.toUpperCase() })} />
            </Field>
          )}
        </div>
        {dayRuleChanged && (
          <p className="notice warn" role="status">
            {t('dayRule.beforeSave')}
          </p>
        )}
        {dstTip && (
          <p className="notice warn" role="note">
            {t('dayRule.dstTip')}
          </p>
        )}
        {pending && (
          <p className="notice aj-ok" role="status">
            {t('dayRule.pending', { date: business.dayRuleEffectiveFrom ? day(business.dayRuleEffectiveFrom) : '' })}
            {pending.timezone && pending.dayCutoff ? ` (${pending.timezone}, ${formatHm(pending.dayCutoff)})` : ''}
          </p>
        )}
        <p className="muted small">{t('business.fixedHint')}</p>
      </Card>

      {rules.length > 0 && (
        <Card title={t('dayRule.historyTitle')}>
          <p className="muted small">{t('dayRule.historyHint')}</p>
          <ul className="aj-rules">
            {rules.map((r, i) => (
              <li key={`${r.from}-${i}`}>
                <strong>{sinceForever(r.from) ? t('dayRule.always') : t('dayRule.from', { date: r.from ? day(r.from) : '—' })}</strong>
                <span>{r.timezone}</span>
                <span>{t('dayRule.cutoff', { time: formatHm(r.dayCutoff) })}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card title={t('modules.title')}>
        <p className="muted">{t('modules.hint')}</p>
        {MODULES.map((m) => (
          <Switch
            key={m}
            label={t(`modules.${m}`)}
            hint={t(`modules.${m}Hint`)}
            checked={moduleOn(business.modules, m)}
            disabled={!canUsePanel || modules.saving}
            onChange={(on) => void modules.save({ modules: { [m]: on } })}
          />
        ))}
        <Notice message={modules.message} />
      </Card>

      <Card title={t('pos.title')}>
        <p className="muted">{t('pos.hint')}</p>
        <div className="chips" role="group" aria-label={t('pos.title')}>
          {POS_VIEWS.map((v) => (
            <button
              key={v}
              type="button"
              disabled={!canUsePanel}
              className={`chip${form.posViews.includes(v) ? ' on' : ''}`}
              aria-pressed={form.posViews.includes(v)}
              onClick={() => set({ posViews: form.posViews.includes(v) ? form.posViews.filter((x) => x !== v) : [...form.posViews, v] })}
            >
              {t(`pos.${v}`)}
            </button>
          ))}
        </div>
        <Switch label={t('pos.registerCheckout')} hint={t('pos.registerCheckoutHint')} checked={form.registerCheckout} disabled={!canUsePanel} onChange={(v) => set({ registerCheckout: v })} />
      </Card>

      <Card title={t('credit.title')}>
        <Switch label={t('credit.requiresCustomer')} hint={t('credit.requiresCustomerHint')} checked={form.creditRequiresCustomer} disabled={!canUsePanel} onChange={(v) => set({ creditRequiresCustomer: v })} />
        <Switch label={t('credit.limitEnforced')} hint={t('credit.limitEnforcedHint')} checked={form.creditLimitEnforced} disabled={!canUsePanel} onChange={(v) => set({ creditLimitEnforced: v })} />
        <div className="aj-grid">
          <Field label={t('credit.dueDays')} hint={t('credit.dueDaysHint')}>
            <input type="number" min={0} max={365} inputMode="numeric" value={form.creditDefaultDueDays} disabled={!canUsePanel} onChange={(e) => set({ creditDefaultDueDays: e.target.value })} />
          </Field>
          <Field label={t('credit.overdueDays')} hint={t('credit.overdueDaysHint')}>
            <input type="number" min={1} max={365} inputMode="numeric" value={form.creditOverdueDays} disabled={!canUsePanel} onChange={(e) => set({ creditOverdueDays: e.target.value })} />
          </Field>
        </div>
      </Card>

      {/* Los turnos manuales ya no se ofrecen: esta tarjeta solo aparece si el negocio aún los exige, para poder apagarlo. */}
      {business.shiftRequired && (
      <Card title={t('shifts.title')}>
        <Switch label={t('shifts.required')} hint={t('shifts.requiredHint')} checked={form.shiftRequired} disabled={!canUsePanel} onChange={(v) => set({ shiftRequired: v })} />
        <Field label={t('shifts.note', { currency })} hint={t('shifts.noteHint')}>
          <input inputMode="decimal" value={form.shiftNote} disabled={!canUsePanel} onChange={(e) => set({ shiftNote: e.target.value })} />
        </Field>
      </Card>
      )}
      {saveBar}
      <Modal open={data.queue != null} title={t('queue.title')} onClose={data.dismissQueue}>
        <p>{t('queue.body', { count: data.queue?.count ?? 0, amount: money(data.queue?.totalMinor ?? 0) })}</p>
        <div className="row">
          <Button onClick={data.dismissQueue}>{t('queue.cancel')}</Button>
          <Button kind="danger" disabled={data.saving} onClick={() => void confirmDiscard()}>
            {t('queue.confirm')}
          </Button>
        </div>
      </Modal>
    </>
  )
}

/** Nombre del país en el idioma de la pantalla (el navegador lo sabe); si no, el código. */
function countryName(code: string, language: string): string {
  try {
    return new Intl.DisplayNames([language.startsWith('en') ? 'en' : 'es'], { type: 'region' }).of(code) ?? code
  } catch {
    return code
  }
}
