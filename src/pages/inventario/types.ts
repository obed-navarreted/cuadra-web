import type { components } from '../../api/schema'

type S = components['schemas']

export type Product = S['ProductView']
export type ProductInput = S['ProductInput']
export type Category = S['CategoryView']
export type Movement = S['MovementView']  // existencias (StockService); los de la caja son CashMovementView
export type MovementInput = S['MovementInput']
export type PurchaseView = S['PurchaseView']
export type PurchaseInput = S['PurchaseInput']
export type PaymentView = S['SupplierPaymentView']
export type SupplierView = S['SupplierView']
export type StockReport = S['Inventory']
export type StockLine = S['StockLine']
export type ImportResult = S['ImportResult']
export type ImportRowResult = S['ImportRowResult']

export const UNITS = ['UNIT', 'LB', 'KG', 'L', 'M'] as const
export const SOURCES = ['CASH_DRAWER', 'BANK', 'CARD', 'OWNER', 'OTHER'] as const
