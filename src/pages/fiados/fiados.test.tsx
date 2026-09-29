import { fireEvent, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import '../../i18n'
import { setLocale } from '../../i18n'
import { renderAs } from '../test-utils'

vi.mock('./api', async (orig) => ({
  ...(await orig<typeof import('./api')>()),
  pay: vi.fn(async () => ({ payments: [], credits: [], created: true })),
  creditSummary: vi.fn(async () => ({ openCount: 2, openTotalMinor: 68000, overdueCount: 0, overdueMinor: 0, overdueAfterDays: 30, customersWithDebt: 1 })),
  listCredits: vi.fn(async () => ({
    items: [{ id: 'c1', customerName: 'Karla Chávez', debtorLabel: 'Karla', amountMinor: 61000, balanceMinor: 61000, paidMinor: 0, status: 'OPEN', ageDays: 3, rev: 1 }],
    page: 0, size: 25, total: 1, last: true,
  })),
}))

import * as api from './api'
import FiadosPage from './index'
import { PayDialog } from './dialogs'

describe('fiados', () => {
  beforeEach(async () => {
    await setLocale('es')
    vi.mocked(api.pay).mockClear()
  })

  it('muestra el total por cobrar y la lista de fiados con dinero formateado por el negocio', async () => {
    renderAs(<FiadosPage />)
    await waitFor(() => expect(screen.getByText('Karla Chávez')).toBeInTheDocument())
    expect(screen.getAllByText(/680\.00/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/610\.00/).length).toBeGreaterThan(0)
    expect(screen.getByText('3 días')).toBeInTheDocument()
  })

  it('un abono de más avisa que se registra igual y manda el monto en unidad menor', async () => {
    renderAs(<PayDialog target={{ creditId: 'c1', title: 'Karla', balanceMinor: 10000 }} onClose={() => undefined} onDone={() => undefined} />)
    const amount = screen.getByLabelText('Monto del abono')
    fireEvent.change(amount, { target: { value: '150' } })
    expect(screen.getByText(/Es C\$\s?50\.00 más de lo que se debe/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Registrar C\$\s?150\.00/ }))
    await waitFor(() => expect(api.pay).toHaveBeenCalled())
    const [businessId, paymentId, body] = vi.mocked(api.pay).mock.calls[0]
    expect(businessId).toBe('b1')
    expect(paymentId).toMatch(/^[0-9a-f-]{36}$/)
    expect(body).toMatchObject({ creditId: 'c1', amountMinor: 15000, method: 'TRANSFER' })
  })

  it('no permite registrar un monto inválido', () => {
    renderAs(<PayDialog target={{ customerId: 'u1', title: 'Karla', balanceMinor: 10000 }} onClose={() => undefined} onDone={() => undefined} />)
    fireEvent.change(screen.getByLabelText('Monto del abono'), { target: { value: '12.555' } })
    expect(screen.getByRole('button', { name: 'Registrar abono' })).toBeDisabled()
  })
})
