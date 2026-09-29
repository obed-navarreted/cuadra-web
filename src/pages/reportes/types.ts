import type { components } from '../../api/schema'

/** Tipos del contrato con nombres cortos (solo tipos: nada de lo generado se copia a mano). */
type S = components['schemas']

export type DayPoint = S['DayPoint']
export type Profit = S['Profit']
export type ReportProduct = S['Product']
export type Receivables = S['Receivables']
export type Debtor = S['Debtor']
export type ExpenseReport = S['ExpenseReport']
export type MemberClosings = S['MemberClosings']
export type ShiftLine = S['ShiftLine']
export type InventoryReport = S['Inventory']
export type StockLine = S['StockLine']
export type OverviewData = S['Overview']
