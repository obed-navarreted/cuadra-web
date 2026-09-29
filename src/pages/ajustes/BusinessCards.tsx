import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { ApiError, call, client } from '../../api/http'
import { useAuth, useBusiness } from '../../auth/context'
import { Button, Card, Field } from '../../components/ui'
import { useFormat } from '../../hooks/useFormat'
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
  async function save(body: UpdateBusiness): Promise<boolean> {
    setSaving(true)
    setMessage(null)
    try {
      await call(client.PUT('/api/b/{businessId}', { params: { path: { businessId: membership.businessId ?? '' } }, body }))
      await reloadBusiness()
      setMessage({ tone: 'ok', text: t('saved') })
      return true
    } catch (e) {
      setMessage({ tone: 'error', text: e instanceof ApiError ? t(`err.${e.code}`, { defaultValue: errorText(t, e) }) : errorText(t, e) })
      return false
    } finally {
      setSaving(false)
    }
  }
  return { saving, message, save, clear: () => setMessage(null) }
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
  const { t } = useTranslation('ajustes')
  const { isOwner } = useAuth()
  const { business } = useBusiness()
  const { day } = useFormat()
  const currency = business.currency ?? 'USD'
  const [form, setForm] = useState<Form>(() => formOf(business))
  const [tried, setTried] = useState(false)
  const data = useSaver()
  const modules = useSaver()
  const error = validateForm(form, currency)
  const patch = patchOf(form, business)
  const dirty = Object.keys(patch).length > 0
  const dayRuleChanged = isOwner && (patch.timezone !== undefined || patch.dayCutoff !== undefined)
  const dstTip = isOwner && dstCutoffTip(form.timezone, form.dayCutoff)
  const rules = [...(business.dayRules ?? [])].sort((a, b) => (b.from ?? '').localeCompare(a.from ?? ''))
  const pending = business.dayRuleEffectiveFrom ? rules.find((r) => r.from === business.dayRuleEffectiveFrom) : undefined
  const set = (p: Partial<Form>) => (data.clear(), setTried(false), setForm((f) => ({ ...f, ...p })))

  async function submit() {
    setTried(true)
    if (error || !dirty) return
    if (await data.save(patch)) setTried(false)
  }

  // Una sola barra de guardado para todo el formulario: aparece cuando hay cambios y se queda fija abajo (también en el celular).
  const showBar = isOwner && (dirty || data.message != null)
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
      {!isOwner && <p className="notice warn">{t('ownerOnly')}</p>}
      <Card title={t('business.title')}>
        <div className="aj-grid">
          <Field label={t('business.name')}>
            <input value={form.name} disabled={!isOwner} maxLength={120} onChange={(e) => set({ name: e.target.value })} />
          </Field>
          <Field label={t('business.type')} hint={t('business.typeHint')}>
            <input value={form.type} disabled={!isOwner} onChange={(e) => set({ type: e.target.value })} />
          </Field>
          <Field label={t('business.locale')}>
            <select value={form.defaultLocale} disabled={!isOwner} onChange={(e) => set({ defaultLocale: e.target.value })}>
              <option value="es">{t('common:language.es')}</option>
              <option value="en">{t('common:language.en')}</option>
            </select>
          </Field>
          <Field label={t('business.timezone')}>
            <select value={form.timezone} disabled={!isOwner} onChange={(e) => set({ timezone: e.target.value })}>
              {timezoneOptions(form.timezone).map((z) => (
                <option key={z} value={z}>
                  {z}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t('business.cutoff')} hint={t('business.cutoffHint')}>
            <input type="time" value={form.dayCutoff} disabled={!isOwner} onChange={(e) => set({ dayCutoff: e.target.value })} />
          </Field>
          <Readonly label={t('business.country')}>{business.country}</Readonly>
          <Readonly label={t('business.currency')}>{currency}</Readonly>
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
            {pending.timezone && pending.dayCutoff ? ` (${pending.timezone}, ${pending.dayCutoff.slice(0, 5)})` : ''}
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
                <span>{t('dayRule.cutoff', { time: (r.dayCutoff ?? '').slice(0, 5) })}</span>
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
            disabled={!isOwner || modules.saving}
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
              disabled={!isOwner}
              className={`chip${form.posViews.includes(v) ? ' on' : ''}`}
              aria-pressed={form.posViews.includes(v)}
              onClick={() => set({ posViews: form.posViews.includes(v) ? form.posViews.filter((x) => x !== v) : [...form.posViews, v] })}
            >
              {t(`pos.${v}`)}
            </button>
          ))}
        </div>
      </Card>

      <Card title={t('credit.title')}>
        <Switch label={t('credit.requiresCustomer')} hint={t('credit.requiresCustomerHint')} checked={form.creditRequiresCustomer} disabled={!isOwner} onChange={(v) => set({ creditRequiresCustomer: v })} />
        <Switch label={t('credit.limitEnforced')} hint={t('credit.limitEnforcedHint')} checked={form.creditLimitEnforced} disabled={!isOwner} onChange={(v) => set({ creditLimitEnforced: v })} />
        <div className="aj-grid">
          <Field label={t('credit.dueDays')} hint={t('credit.dueDaysHint')}>
            <input type="number" min={0} max={365} inputMode="numeric" value={form.creditDefaultDueDays} disabled={!isOwner} onChange={(e) => set({ creditDefaultDueDays: e.target.value })} />
          </Field>
          <Field label={t('credit.overdueDays')} hint={t('credit.overdueDaysHint')}>
            <input type="number" min={1} max={365} inputMode="numeric" value={form.creditOverdueDays} disabled={!isOwner} onChange={(e) => set({ creditOverdueDays: e.target.value })} />
          </Field>
        </div>
      </Card>

      {/* Los turnos manuales ya no se ofrecen: esta tarjeta solo aparece si el negocio aún los exige, para poder apagarlo. */}
      {business.shiftRequired && (
      <Card title={t('shifts.title')}>
        <Switch label={t('shifts.required')} hint={t('shifts.requiredHint')} checked={form.shiftRequired} disabled={!isOwner} onChange={(v) => set({ shiftRequired: v })} />
        <Field label={t('shifts.note', { currency })} hint={t('shifts.noteHint')}>
          <input inputMode="decimal" value={form.shiftNote} disabled={!isOwner} onChange={(e) => set({ shiftNote: e.target.value })} />
        </Field>
      </Card>
      )}
      {saveBar}
    </>
  )
}
