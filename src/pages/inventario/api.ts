import { call, client } from '../../api/http'
import type { Category, ImportResult, Movement, MovementInput, PaymentView, Product, ProductHistoryEntry, ProductInput, Promotion, PromotionInput, PurchaseInput, PurchaseView, StockReport, SupplierView } from './types'
import type { components } from '../../api/schema'

type ImportRow = components['schemas']['ImportRow']

/** Todo el catálogo activo, página a página (la API entrega hasta 200 por página). Tope de seguridad: 5 000 productos. */
export async function loadProducts(businessId: string): Promise<Product[]> {
  const out: Product[] = []
  for (let page = 0; page < 25; page++) {
    const r = await call(client.GET('/api/b/{businessId}/products', { params: { path: { businessId }, query: { page, size: 200 } } }))
    out.push(...(r.items ?? []))
    if (r.last) break
  }
  return out
}

export const loadCategories = (businessId: string): Promise<Category[]> => call(client.GET('/api/b/{businessId}/categories', { params: { path: { businessId } } }))

export const saveProduct = (businessId: string, productId: string, body: ProductInput): Promise<Product> =>
  call(client.PUT('/api/b/{businessId}/products/{productId}', { params: { path: { businessId, productId } }, body }))

export const deactivateProduct = (businessId: string, productId: string): Promise<void> =>
  call(client.DELETE('/api/b/{businessId}/products/{productId}', { params: { path: { businessId, productId } } }))

export const loadProductHistory = (businessId: string, productId: string): Promise<ProductHistoryEntry[]> =>
  call(client.GET('/api/b/{businessId}/products/{productId}/history', { params: { path: { businessId, productId } } }))

export const loadStockReport = (businessId: string): Promise<StockReport> => call(client.GET('/api/b/{businessId}/reports/inventory', { params: { path: { businessId } } }))

export async function loadMovements(businessId: string, productId: string): Promise<{ items: Movement[]; total: number }> {
  const r = await call(client.GET('/api/b/{businessId}/products/{productId}/stock-movements', { params: { path: { businessId, productId }, query: { page: 0, size: 50 } } }))
  return { items: r.items ?? [], total: r.total }
}

/** Un conteo, una baja o una devolución. `movementId` es nuevo en cada acción (así repetir el envío no duplica nada). */
export const addMovement = (businessId: string, movementId: string, body: MovementInput): Promise<Movement> =>
  call(client.PUT('/api/b/{businessId}/stock-movements/{movementId}', { params: { path: { businessId, movementId } }, body }))

export async function loadPurchases(businessId: string, filter: { supplierId?: string; onlyOwed: boolean; includeVoided: boolean }, page: number): Promise<{ items: PurchaseView[]; last: boolean }> {
  const r = await call(
    client.GET('/api/b/{businessId}/purchases', { params: { path: { businessId }, query: { supplierId: filter.supplierId || undefined, onlyOwed: filter.onlyOwed, includeVoided: filter.includeVoided, page, size: 50 } } }),
  )
  return { items: r.items ?? [], last: r.last }
}

export const registerPurchase = (businessId: string, purchaseId: string, body: PurchaseInput): Promise<PurchaseView> =>
  call(client.PUT('/api/b/{businessId}/purchases/{purchaseId}', { params: { path: { businessId, purchaseId } }, body }))

export const voidPurchase = (businessId: string, purchaseId: string, reason: string): Promise<PurchaseView> =>
  call(client.POST('/api/b/{businessId}/purchases/{purchaseId}/void', { params: { path: { businessId, purchaseId } }, body: { reason: reason || undefined } }))

export const loadPayments = (businessId: string, purchaseId: string): Promise<PaymentView[]> =>
  call(client.GET('/api/b/{businessId}/purchases/{purchaseId}/payments', { params: { path: { businessId, purchaseId } } }))

export const paySupplier = (businessId: string, paymentId: string, body: { purchaseId: string; amountMinor: number; source: string; note?: string }): Promise<PaymentView> =>
  call(client.PUT('/api/b/{businessId}/supplier-payments/{paymentId}', { params: { path: { businessId, paymentId } }, body }))

export const voidPayment = (businessId: string, paymentId: string, reason: string): Promise<PaymentView> =>
  call(client.POST('/api/b/{businessId}/supplier-payments/{paymentId}/void', { params: { path: { businessId, paymentId } }, body: { reason: reason || undefined } }))

export const loadSuppliers = (businessId: string): Promise<SupplierView[]> =>
  call(client.GET('/api/b/{businessId}/suppliers', { params: { path: { businessId }, query: { includeInactive: true } } }))

export const saveSupplier = (businessId: string, supplierId: string, body: { name: string; phone?: string; notes?: string; active: boolean }): Promise<SupplierView> =>
  call(client.PUT('/api/b/{businessId}/suppliers/{supplierId}', { params: { path: { businessId, supplierId } }, body }))

export const importProducts = (businessId: string, rows: ImportRow[], dryRun: boolean): Promise<ImportResult> =>
  call(client.POST('/api/b/{businessId}/products/import', { params: { path: { businessId }, query: { dryRun } }, body: { rows } }))

// ---------- promociones por cantidad ----------

export const loadPromotions = (businessId: string): Promise<Promotion[]> => call(client.GET('/api/b/{businessId}/promotions', { params: { path: { businessId } } }))

export const savePromotion = (businessId: string, id: string, body: PromotionInput): Promise<Promotion> =>
  call(client.PUT('/api/b/{businessId}/promotions/{id}', { params: { path: { businessId, id } }, body }))

/** Pausar (`false`) o reanudar (`true`): los teléfonos lo reciben al sincronizar (al instante si tienen avisos de Firebase). */
export const setPromotionActive = (businessId: string, id: string, active: boolean): Promise<Promotion> =>
  call(client.POST('/api/b/{businessId}/promotions/{id}/active', { params: { path: { businessId, id } }, body: { active } }))

export const deletePromotion = (businessId: string, id: string): Promise<void> => call(client.DELETE('/api/b/{businessId}/promotions/{id}', { params: { path: { businessId, id } } }))
