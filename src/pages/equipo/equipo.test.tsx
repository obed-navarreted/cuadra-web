import { fireEvent, screen, waitFor, within } from '@testing-library/react'
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

  it('el administrador ve acciones en cajeros, otros admins y en sí mismo, y la fila del dueño solo de lectura', async () => {
    renderAs(<MembersView />, 'ADMIN')
    await waitFor(() => expect(screen.getByText('Kevin')).toBeInTheDocument())
    // Filas: Dueña (sin botones y con candado), Ana (ella misma), Kevin (cajero).
    expect(screen.getAllByRole('button', { name: 'Editar' })).toHaveLength(2)
    expect(screen.getAllByRole('button', { name: 'Cambiar PIN' })).toHaveLength(2)
    expect(screen.getByText('Solo el dueño puede modificar esta cuenta')).toBeInTheDocument()
  })

  it('el dueño gestiona a todos y no ve el candado', async () => {
    renderAs(<MembersView />, 'OWNER')
    await waitFor(() => expect(screen.getByText('Kevin')).toBeInTheDocument())
    expect(screen.getAllByRole('button', { name: 'Editar' })).toHaveLength(3)
    expect(screen.queryByText('Solo el dueño puede modificar esta cuenta')).not.toBeInTheDocument()
  })

  it('en la propia fila no se puede cambiar el rol ni dar de baja; en la de otro sí', async () => {
    renderAs(<MembersView />, 'OWNER')
    await waitFor(() => expect(screen.getByText('Kevin')).toBeInTheDocument())
    const rows = screen.getAllByRole('row')
    fireEvent.click(within(rows[1]).getByRole('button', { name: 'Editar' }))
    expect(screen.queryByLabelText('Puede entrar a la caja')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    fireEvent.click(within(rows[3]).getByRole('button', { name: 'Editar' }))
    expect(screen.getByLabelText('Puede entrar a la caja')).toBeInTheDocument()
    expect(screen.getByLabelText('Rol')).toBeInTheDocument()
  })

  it('el administrador ofrece cajero y administrador al crear un miembro y al invitar', async () => {
    const { unmount } = renderAs(<MembersView />, 'ADMIN')
    await waitFor(() => expect(screen.getByText('Kevin')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: 'Nuevo miembro' }))
    expect(screen.getByRole('option', { name: 'Administrador' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Cajero' })).toBeInTheDocument()
    unmount()
    renderAs(<InvitationsView />, 'ADMIN')
    await waitFor(() => expect(screen.getByText('ABCD2345')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: 'Nueva invitación' }))
    expect(screen.getByRole('option', { name: 'Administrador' })).toBeInTheDocument()
  })

  it('los errores del servidor se explican en el idioma de la pantalla', async () => {
    const { ApiError } = await import('../../api/http')
    vi.mocked(api.createMember).mockRejectedValueOnce(new ApiError(400, 'INVALID_PIN', 'x'))
    renderAs(<MembersView />, 'OWNER')
    await waitFor(() => expect(screen.getByText('Kevin')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: 'Nuevo miembro' }))
    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Rosa' } })
    fireEvent.change(screen.getByLabelText(/PIN \(4 a 6/), { target: { value: '4821' } })
    fireEvent.click(screen.getByRole('button', { name: 'Crear miembro' }))
    expect(await screen.findByText('El PIN debe tener de 4 a 6 dígitos.')).toBeInTheDocument()
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
