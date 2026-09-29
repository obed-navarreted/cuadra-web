import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
import { useBusiness } from '../../auth/context'
import { Page, Tabs } from '../../components/ui'
import { ImportTab } from './ImportTab'
import { ProductsTab } from './ProductsTab'
import { PurchasesTab } from './PurchasesTab'
import { StockTab } from './StockTab'
import { SuppliersTab } from './SuppliersTab'
import './inventario.css'

type Tab = 'products' | 'stock' | 'purchases' | 'suppliers' | 'import'

/**
 * Catálogo, existencias, compras y proveedores. El catálogo y la importación sirven aunque el negocio no lleve inventario (se vende sin descontar
 * existencias y eso es correcto); existencias, compras y proveedores solo aparecen con el módulo de inventario encendido, igual que en la app.
 */
export default function InventarioPage() {
  const { t } = useTranslation('inventario')
  const { business } = useBusiness()
  const inventory = business.modules?.inventory === true
  const [params, setParams] = useSearchParams()
  // Un cambio en una pestaña (una compra suma existencias, un conteo cambia el valor…) vuelve a cargar las demás.
  const [reloadKey, setReloadKey] = useState(0)
  const changed = () => setReloadKey((k) => k + 1)

  const available: Tab[] = inventory ? ['products', 'stock', 'purchases', 'suppliers', 'import'] : ['products', 'import']
  const requested = params.get('tab') as Tab | null
  const tab: Tab = requested && available.includes(requested) ? requested : 'products'
  const supplier = params.get('supplier') ?? ''
  const go = (next: Tab, supplierId = '') => setParams(next === 'products' ? {} : supplierId ? { tab: next, supplier: supplierId } : { tab: next })

  return (
    <Page title={inventory ? t('title') : t('titleCatalog')} subtitle={inventory ? undefined : t('catalogOnly')}>
      <Tabs value={tab} onChange={(k) => go(k)} items={available.map((k) => ({ key: k, label: t(`tabs.${k}`) }))} />
      {tab === 'products' && <ProductsTab inventory={inventory} reloadKey={reloadKey} onChanged={changed} />}
      {tab === 'stock' && <StockTab reloadKey={reloadKey} onChanged={changed} />}
      {tab === 'purchases' && <PurchasesTab supplierId={supplier} onSupplier={(id) => go('purchases', id)} reloadKey={reloadKey} onChanged={changed} />}
      {tab === 'suppliers' && <SuppliersTab reloadKey={reloadKey} onChanged={changed} onOpenPurchases={(id) => go('purchases', id)} />}
      {tab === 'import' && <ImportTab inventory={inventory} onChanged={changed} />}
    </Page>
  )
}
