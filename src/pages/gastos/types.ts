import type { components } from '../../api/schema'

type S = components['schemas']
export type ExpenseSummary = S['ExpenseSummary']
export type CashMovement = S['CashMovementView']
export type Expense = S['ExpenseView']
export type ExpenseCategory = S['ExpenseCategoryView']

export const SOURCES = ['CASH_DRAWER', 'BANK', 'CARD', 'OWNER', 'OTHER'] as const
export type Source = (typeof SOURCES)[number]
