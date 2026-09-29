import { describe, expect, it } from 'vitest'
import { draftTotal, emptyPurchase, toPurchaseInput, type PurchaseDraft } from './purchaseDraft'

const id = (l: { key: string }) => `id-${l.key}`
const base = (): PurchaseDraft => ({ ...emptyPurchase('a'), lines: [{ key: 'a', productId: 'p1', name: '', quantity: '5', cost: '32' }] })

describe('compra en armado', () => {
  it('suma solo las líneas completas, redondeando como el servidor', () => {
    const d = base()
    d.lines.push({ key: 'b', productId: '', name: 'Bolsas', quantity: '1', cost: '3' }, { key: 'c', productId: '', name: 'Incompleta', quantity: '', cost: '9' })
    expect(draftTotal(d, 'NIO')).toBe(16300)
  })

  it('por defecto se paga todo y el proveedor escrito solo va sin proveedor elegido', () => {
    const { input, total } = toPurchaseInput({ ...base(), supplierName: ' Don Pedro ' }, 'NIO', id)
    expect(total).toBe(16000)
    expect(input).toMatchObject({ supplierName: 'Don Pedro', paidMinor: 16000, paidSource: 'CASH_DRAWER' })
    expect(input?.supplierId).toBeUndefined()
    expect(input?.lines?.[0]).toMatchObject({ id: 'id-a', productId: 'p1', quantityMilli: 5000, unitCostMinor: 3200 })
    const withSupplier = toPurchaseInput({ ...base(), supplierId: 's1', supplierName: 'ignorado' }, 'NIO', id).input
    expect(withSupplier).toMatchObject({ supplierId: 's1' })
    expect(withSupplier?.supplierName).toBeUndefined()
  })

  it('pagado parcial, nada o de más', () => {
    expect(toPurchaseInput({ ...base(), paid: '100' }, 'NIO', id).input).toMatchObject({ paidMinor: 10000 })
    const none = toPurchaseInput({ ...base(), paid: '' }, 'NIO', id).input
    expect(none?.paidMinor).toBeUndefined()
    expect(none?.paidSource).toBeUndefined()
    expect(toPurchaseInput({ ...base(), paid: '161' }, 'NIO', id).problems).toEqual(['paid'])
    expect(toPurchaseInput({ ...base(), paid: 'abc' }, 'NIO', id).problems).toEqual(['paid'])
  })

  it('marca líneas inválidas y exige al menos una', () => {
    expect(toPurchaseInput(emptyPurchase('a'), 'NIO', id).problems).toEqual(['lines'])
    const d = base()
    d.lines.push({ key: 'x', productId: '', name: '', quantity: '1', cost: '1' }, { key: 'y', productId: 'p2', name: '', quantity: '0', cost: '1' })
    expect(toPurchaseInput(d, 'NIO', id).problems).toEqual(['line:x', 'line:y'])
  })
})
