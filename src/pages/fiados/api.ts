import { call, client } from '../../api/http'
import type { components } from '../../api/schema'

type S = components['schemas']

export type CreditView = S['CreditView']
export type CustomerView = S['CustomerView']
export type PaymentView = S['CreditPaymentView']
export type Movement = S['Movement']

export type Page<T> = { items: T[]; page: number; size: number; total: number; last: boolean }

/** El contrato marca `items` como opcional; la pantalla siempre trabaja con una lista. */
function pageOf<T>(r: { items?: T[] | null; page: number; size: number; total: number; last: boolean }): Page<T> {
  return { items: r.items ?? [], page: r.page, size: r.size, total: r.total, last: r.last }
}

export type CreditSummary = S['CreditSummary']
export type Statement = S['Statement']
export type PayResult = S['PayResult']

export type CreditFilter = { status: 'OPEN' | 'PAID' | 'ALL'; linked: 'ALL' | 'WITH' | 'WITHOUT'; oldOnly: boolean; q: string; sort: 'OLDEST' | 'AMOUNT' | 'RECENT'; page: number }
export const PAGE_SIZE = 25

export async function listCredits(businessId: string, f: CreditFilter, overdueAfterDays: number): Promise<Page<CreditView>> {
  return pageOf(await call(
    client.GET('/api/b/{businessId}/credits', {
      params: {
        path: { businessId },
        query: {
          status: f.status,
          linked: f.linked === 'ALL' ? undefined : f.linked,
          minDays: f.oldOnly ? overdueAfterDays : undefined,
          q: f.q.trim() || undefined,
          sort: f.sort,
          page: f.page,
          size: PAGE_SIZE,
        },
      },
    }),
  ))
}

export function creditSummary(businessId: string): Promise<CreditSummary> {
  return call(client.GET('/api/b/{businessId}/credits/summary', { params: { path: { businessId } } }))
}

export async function listCustomers(businessId: string, q: string, withDebtOnly: boolean, includeArchived: boolean, page: number): Promise<Page<CustomerView>> {
  return pageOf(await call(
    client.GET('/api/b/{businessId}/customers', {
      params: { path: { businessId }, query: { q: q.trim() || undefined, withDebtOnly, includeArchived, page, size: PAGE_SIZE } },
    }),
  ))
}

export function statement(businessId: string, customerId: string): Promise<Statement> {
  return call(client.GET('/api/b/{businessId}/customers/{customerId}/statement', { params: { path: { businessId, customerId } } }))
}

export type CustomerInput = { name: string; phone?: string; notes?: string; creditLimitMinor?: number; archived?: boolean }

export function saveCustomer(businessId: string, customerId: string, body: CustomerInput): Promise<CustomerView> {
  return call(client.PUT('/api/b/{businessId}/customers/{customerId}', { params: { path: { businessId, customerId } }, body })) as Promise<CustomerView>
}

export type PayInput = { creditId?: string; customerId?: string; amountMinor: number; method: string; reference?: string }

/** El id del abono lo genera la pantalla al abrir el diálogo: repetir el envío (doble clic, reintento) no cobra dos veces. */
export function pay(businessId: string, paymentId: string, body: PayInput): Promise<PayResult> {
  return call(client.PUT('/api/b/{businessId}/credit-payments/{paymentId}', { params: { path: { businessId, paymentId } }, body }))
}

export function voidPayment(businessId: string, paymentId: string, reason: string): Promise<PayResult> {
  return call(client.POST('/api/b/{businessId}/credit-payments/{paymentId}/void', { params: { path: { businessId, paymentId } }, body: { reason } }))
}

export function writeOff(businessId: string, creditId: string, reason: string): Promise<CreditView> {
  return call(client.POST('/api/b/{businessId}/credits/{creditId}/write-off', { params: { path: { businessId, creditId } }, body: { reason } })) as Promise<CreditView>
}

export function linkCustomer(businessId: string, creditId: string, customerId: string): Promise<CreditView> {
  return call(client.POST('/api/b/{businessId}/credits/{creditId}/link-customer', { params: { path: { businessId, creditId } }, body: { customerId } })) as Promise<CreditView>
}

export type ManualCredit = { debtorLabel: string; debtorPhone?: string; customerId?: string; amountMinor: number; note?: string; dueDate?: string }

export function createCredit(businessId: string, creditId: string, body: ManualCredit): Promise<CreditView> {
  return call(client.PUT('/api/b/{businessId}/credits/{creditId}', { params: { path: { businessId, creditId } }, body })) as Promise<CreditView>
}
