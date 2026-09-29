import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { useBusiness } from '../../auth/context'
import { Button, Card, Page, Spinner, Tag } from '../../components/ui'
import { usePlan } from '../../plan/context'
import { situation, usageLevel, usagePercent, type PlanView } from '../../plan/logic'
import { compareRows, freeSections, usageRows, type CompareRow } from './logic'
import './plan.css'

/** Plan y facturación: en qué plan está el negocio, cuánto usa, qué cambia con Pro y qué pasa al terminar la prueba. No hay cobro todavía y no se inventa uno. */
export default function PlanPage() {
  const { t } = useTranslation('plan')
  const { plan, loading, failed, reload } = usePlan()
  // Al entrar se refresca: el uso cambia cuando se agregan personas o teléfonos.
  useEffect(() => {
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <Page title={t('title')} subtitle={t('subtitle')}>
      <div className="plan-stack">
        {loading && !plan && <Spinner />}
        {failed && !plan && (
          <div className="notice warn" role="status">
            <span className="grow">{t('loadError')}</span>
            <Button small onClick={reload}>
              {t('common:shell.retry')}
            </Button>
          </div>
        )}
        {plan && (
          <>
            <Current plan={plan} />
            <Usage plan={plan} />
            <Compare plan={plan} />
            <AfterTrial />
          </>
        )}
        <Payment />
      </div>
    </Page>
  )
}

function useDate() {
  const { i18n } = useTranslation()
  const { business } = useBusiness()
  return (iso?: string | null) => (iso ? new Intl.DateTimeFormat(i18n.language, { dateStyle: 'long', timeZone: business.timezone ?? 'UTC' }).format(new Date(iso)) : null)
}

function Current({ plan }: { plan: PlanView }) {
  const { t } = useTranslation('plan')
  const date = useDate()
  const kind = situation(plan)
  const message =
    kind === 'trial' ? (plan.trialDaysLeft <= 0 ? t('current.trialLast') : t('current.trial', { count: plan.trialDaysLeft })) : t(`current.${kind}`)
  const end = kind === 'trial' ? date(plan.trialEndsAt) : date(plan.currentPeriodEnd)
  return (
    <Card>
      <div className="plan-head">
        <span className="plan-name">{t(`current.${plan.plan === 'PRO' ? 'PRO' : 'FREE'}`)}</span>
        {plan.status && <Tag tone={kind === 'trial' ? 'green' : kind === 'pastDue' ? 'orange' : 'neutral'}>{t(`current.status.${plan.status}`, { defaultValue: plan.status })}</Tag>}
      </div>
      <p className="plan-msg">{message}</p>
      <div className="plan-dates muted small">
        {kind === 'trial' && end && <span>{t('current.trialEnds', { date: end })}</span>}
        {kind !== 'trial' && kind !== 'free' && (end ? <span>{t('current.periodEnd', { date: end })}</span> : <span>{t('current.noEnd')}</span>)}
      </div>
    </Card>
  )
}

function Usage({ plan }: { plan: PlanView }) {
  const { t } = useTranslation('plan')
  const rows = usageRows(plan)
  if (rows.length === 0) return null
  return (
    <Card title={t('usage.title')}>
      <p className="muted small">{t('usage.hint')}</p>
      <div className="plan-usage">
        {rows.map((r) => {
          const level = usageLevel(r.used, r.limit)
          const label = t(`usage.${r.key}`, { used: r.used, limit: r.limit })
          return (
            <div className="plan-meter" key={r.key}>
              <div className="plan-meter-top">
                <span>{label}</span>
                {level !== 'ok' && <Tag tone={level === 'full' ? 'red' : 'orange'}>{t(`usage.${level}`)}</Tag>}
              </div>
              <div className={`plan-track ${level}`} role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={r.limit} aria-valuenow={Math.min(r.used, r.limit)}>
                <span style={{ width: `${usagePercent(r.used, r.limit)}%` }} />
              </div>
            </div>
          )
        })}
      </div>
    </Card>
  )
}

function Compare({ plan }: { plan: PlanView }) {
  const { t } = useTranslation('plan')
  const rows = compareRows(plan)
  const isPro = plan.plan === 'PRO'
  const free = freeSections(plan)
  const show = (value: CompareRow['free']) => {
    if (typeof value === 'number') return value
    if (typeof value === 'boolean') return t(value ? 'compare.yes' : 'compare.no')
    if (value === 'sections') return <span className="plan-sections">{free.map((s) => t(`sections.${s}`, { defaultValue: s })).join(', ')}</span>
    const key = { history30: 'history30', unlimited: 'historyAll', all: 'sectionsAll', one: 'one', several: 'several' }[value]
    return t(`compare.${key ?? value}`)
  }
  return (
    <Card title={t('compare.title')}>
      <div className="table-wrap">
        <table className="data plan-compare">
          <thead>
            <tr>
              <th scope="col">{t('compare.feature')}</th>
              <th scope="col" className={isPro ? undefined : 'on'}>
                {t('compare.free')}
                {!isPro && <span className="mine">{t('compare.yourPlan')}</span>}
              </th>
              <th scope="col" className={isPro ? 'on' : undefined}>
                {t('compare.pro')}
                {isPro && <span className="mine">{t('compare.yourPlan')}</span>}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key}>
                <th scope="row">{t(`compare.${r.key}`)}</th>
                <td className={isPro ? undefined : 'on'}>{show(r.free)}</td>
                <td className={isPro ? 'on' : undefined}>{show(r.pro)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="muted small">{t('compare.note')}</p>
    </Card>
  )
}

function AfterTrial() {
  const { t } = useTranslation('plan')
  return (
    <Card title={t('afterTrial.title')}>
      <ul className="plan-list">
        {(['nothingDeleted', 'onlyLimits', 'keepWorking', 'existing'] as const).map((k) => (
          <li key={k}>{t(`afterTrial.${k}`)}</li>
        ))}
      </ul>
    </Card>
  )
}

function Payment() {
  const { t } = useTranslation('plan')
  return (
    <Card title={t('payment.title')}>
      <p className="plan-msg">{t('payment.body')}</p>
      <p>
        <Link className="btn" to="/ayuda">
          {t('payment.contact')}
        </Link>
      </p>
    </Card>
  )
}
