import { fireEvent, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { setLocale } from '../../i18n'
import { renderAs } from '../test-utils'

const members = [
  { id: 'm-owner', displayName: 'Dueña', role: 'OWNER', status: 'ACTIVE', hasGoogle: true, pinSet: false, pinMustChange: false },
  { id: 'm-admin', displayName: 'Ana', role: 'ADMIN', status: 'ACTIVE', hasGoogle: false, pinSet: true, pinMustChange: false },
  { id: 'm-cash', displayName: 'Kevin', role: 'CASHIER', status: 'ACTIVE', hasGoogle: false, pinSet: true, pinMustChange: false },
]

vi.mock('./api', async (orig) => ({
  ...(await orig<typeof import('./api')>()),
  listMembers: vi.fn(async () => members),
  createMember: vi.fn(async () => members[2]),
  listInvitations: vi.fn(async () => [{ id: 'i1', role: 'CASHIER', code: 'ABCD2345', url: 'http://x/i/ABCD2345', maxUses: 1, usedCount: 0, expiresAt: '2026-10-06T12:00:00Z' }]),
}))

import * as api from './api'
import { InvitationsView } from './InvitationsView'
import { MembersView } from './MembersView'

describe('equipo', () => {
  beforeEach(async () => {
    await setLocale('es')
  })

  it('un administrador solo gestiona cajeros (y a sí mismo); el dueño gestiona a todos menos a nadie sobre el dueño', async () => {
    const { unmount } = renderAs(<MembersView />, 'ADMIN')
    await waitFor(() => expect(screen.getByText('Kevin')).toBeInTheDocument())
    // Filas: Dueña (sin botones), Ana (ella misma: sí), Kevin (cajero: sí).
    expect(screen.getAllByRole('button', { name: 'Editar' })).toHaveLength(2)
    unmount()
    renderAs(<MembersView />, 'OWNER')
    await waitFor(() => expect(screen.getByText('Kevin')).toBeInTheDocument())
    // El dueño se edita a sí mismo, a Ana y a Kevin.
    expect(screen.getAllByRole('button', { name: 'Editar' })).toHaveLength(3)
  })

  it('un administrador no puede asignar el rol de administrador; el dueño sí', async () => {
    renderAs(<MembersView />, 'ADMIN')
    await waitFor(() => expect(screen.getByText('Kevin')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: 'Nuevo miembro' }))
    expect(screen.queryByRole('option', { name: 'Administrador' })).not.toBeInTheDocument()
  })

  it('el PIN debe tener de 4 a 6 dígitos y se muestra una sola vez al crear', async () => {
    renderAs(<MembersView />, 'OWNER')
    await waitFor(() => expect(screen.getByText('Kevin')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: 'Nuevo miembro' }))
    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Rosa' } })
    fireEvent.change(screen.getByLabelText(/PIN \(4 a 6/), { target: { value: '12' } })
    const create = screen.getByRole('button', { name: 'Crear miembro' })
    expect(create).toBeDisabled()
    fireEvent.change(screen.getByLabelText(/PIN \(4 a 6/), { target: { value: '48a2' } })
    expect((screen.getByLabelText(/PIN \(4 a 6/) as HTMLInputElement).value).toBe('482')
    fireEvent.change(screen.getByLabelText(/PIN \(4 a 6/), { target: { value: '4821' } }) 
    expect(create).toBeEnabled()
    fireEvent.click(create)
    await waitFor(() => expect(api.createMember).toHaveBeenCalledWith('b1', { displayName: 'Rosa', role: 'CASHIER', pin: '4821', mustChangePin: true }))
    await waitFor(() => expect(screen.getByText('4821')).toBeInTheDocument())
    expect(screen.getByText(/no se puede volver a ver/)).toBeInTheDocument()
  })

  it('copiar el enlace de una invitación lo anuncia', async () => {
    const writeText = vi.fn(async () => undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    renderAs(<InvitationsView />, 'OWNER')
    await waitFor(() => expect(screen.getByText('ABCD2345')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: 'Copiar enlace' }))
    await waitFor(() => expect(writeText).toHaveBeenCalledWith('http://x/i/ABCD2345'))
    await waitFor(() => expect(screen.getAllByText('Copiado').length).toBeGreaterThan(0))
  })
})
