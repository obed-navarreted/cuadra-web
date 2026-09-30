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
  updateMember: vi.fn(async () => members[2]),
  renewAccessCode: vi.fn(async () => ({ accessCode: '48213' })),
  listDevices: vi.fn(async () => []),
  setAccessCode: vi.fn(async (_b: string, code: string) => ({ accessCode: code })),
}))

import * as api from './api'
import { AccessCodeCard } from './AccessCodeCard'
import EquipoPage from './index'
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

  it('el administrador ofrece cajero y administrador al crear un miembro', async () => {
    renderAs(<MembersView />, 'ADMIN')
    await waitFor(() => expect(screen.getByText('Kevin')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: 'Agregar persona' }))
    expect(screen.getByRole('option', { name: 'Administrador' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Cajero' })).toBeInTheDocument()
  })

  it('los errores del servidor se explican en el idioma de la pantalla', async () => {
    const { ApiError } = await import('../../api/http')
    vi.mocked(api.createMember).mockRejectedValueOnce(new ApiError(400, 'INVALID_PIN', 'x'))
    renderAs(<MembersView />, 'OWNER')
    await waitFor(() => expect(screen.getByText('Kevin')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: 'Agregar persona' }))
    fireEvent.change(screen.getByLabelText(/^Nombre \(es su usuario\)/), { target: { value: 'Rosa' } })
    fireEvent.change(screen.getByLabelText(/^PIN \(5 números\)/), { target: { value: '48213' } })
    fireEvent.change(screen.getByLabelText('Repetir PIN'), { target: { value: '48213' } })
    fireEvent.click(screen.getByRole('button', { name: 'Crear persona' }))
    expect(await screen.findByText('El PIN debe tener exactamente 5 números.')).toBeInTheDocument()
  })

  it('el PIN debe tener exactamente 5 números y se muestra una sola vez al crear', async () => {
    renderAs(<MembersView />, 'OWNER')
    await waitFor(() => expect(screen.getByText('Kevin')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: 'Agregar persona' }))
    fireEvent.change(screen.getByLabelText(/^Nombre \(es su usuario\)/), { target: { value: 'Rosa' } })
    fireEvent.change(screen.getByLabelText(/^PIN \(5 números\)/), { target: { value: '12' } })
    const create = screen.getByRole('button', { name: 'Crear persona' })
    expect(create).toBeDisabled()
    fireEvent.change(screen.getByLabelText(/^PIN \(5 números\)/), { target: { value: '48a2' } })
    expect((screen.getByLabelText(/^PIN \(5 números\)/) as HTMLInputElement).value).toBe('482')
    fireEvent.change(screen.getByLabelText(/^PIN \(5 números\)/), { target: { value: '4821' } })
    expect(create).toBeDisabled() // 4 dígitos no bastan
    fireEvent.change(screen.getByLabelText(/^PIN \(5 números\)/), { target: { value: '4821399' } })
    expect((screen.getByLabelText(/^PIN \(5 números\)/) as HTMLInputElement).value).toBe('48213') // no pasa de 5
    fireEvent.change(screen.getByLabelText(/^PIN \(5 números\)/), { target: { value: '48213' } })
    expect(create).toBeDisabled() // falta repetir el PIN
    fireEvent.change(screen.getByLabelText('Repetir PIN'), { target: { value: '48214' } })
    expect(create).toBeDisabled()
    expect(screen.getByText('Los dos PIN no coinciden.')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Repetir PIN'), { target: { value: '48213' } })
    expect(create).toBeEnabled()
    fireEvent.click(create)
    await waitFor(() => expect(api.createMember).toHaveBeenCalledWith('b1', { displayName: 'Rosa', role: 'CASHIER', pin: '48213', mustChangePin: true }))
    // Tarjeta de confirmación: negocio, código, usuario y PIN.
    await waitFor(() => expect(screen.getByText('48213')).toBeInTheDocument())
    expect(screen.getByText('13085')).toBeInTheDocument()
    expect(screen.getByText('Rosa', { selector: 'dd' })).toBeInTheDocument()
    expect(screen.getByText(/no se puede volver a ver/)).toBeInTheDocument()
    const writeText = vi.fn(async () => undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    fireEvent.click(screen.getByRole('button', { name: 'Copiar datos' }))
    await waitFor(() => expect(writeText).toHaveBeenCalledWith('Para entrar a Negocio en la app Cuentiva: código 13085, usuario Rosa, PIN 48213.'))
  })

  it('NAME_TAKEN se explica al crear y al renombrar', async () => {
    const { ApiError } = await import('../../api/http')
    vi.mocked(api.createMember).mockRejectedValueOnce(new ApiError(409, 'NAME_TAKEN', 'x'))
    renderAs(<MembersView />, 'OWNER')
    await waitFor(() => expect(screen.getByText('Kevin')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: 'Agregar persona' }))
    fireEvent.change(screen.getByLabelText(/^Nombre \(es su usuario\)/), { target: { value: 'Kevin' } })
    fireEvent.change(screen.getByLabelText(/^PIN \(5 números\)/), { target: { value: '48213' } })
    fireEvent.change(screen.getByLabelText('Repetir PIN'), { target: { value: '48213' } })
    fireEvent.click(screen.getByRole('button', { name: 'Crear persona' }))
    expect(await screen.findByText('Ya hay alguien con ese nombre en este negocio.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    vi.mocked(api.updateMember).mockRejectedValueOnce(new ApiError(409, 'NAME_TAKEN', 'x'))
    fireEvent.click(within(screen.getAllByRole('row')[2]).getByRole('button', { name: 'Editar' }))
    fireEvent.change(screen.getByLabelText(/^Nombre \(es su usuario\)/), { target: { value: 'Kevin' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    expect(await screen.findByText('Ya hay alguien con ese nombre en este negocio.')).toBeInTheDocument()
  })

  it('la columna se llama Usuario y no hay pestaña de invitaciones', async () => {
    renderAs(<EquipoPage />, 'OWNER')
    await waitFor(() => expect(screen.getByText('Kevin')).toBeInTheDocument())
    expect(screen.getByRole('columnheader', { name: 'Usuario' })).toBeInTheDocument()
    expect(screen.queryByRole('tab', { name: 'Invitaciones' })).not.toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Teléfonos' })).toBeInTheDocument()
  })

  it('el código del negocio: ambos lo ven y lo copian; solo el dueño lo renueva', async () => {
    const writeText = vi.fn(async () => undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    const { unmount } = renderAs(<AccessCodeCard />, 'ADMIN')
    expect(screen.getByText('13085')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Renovar código' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Copiar' }))
    await waitFor(() => expect(writeText).toHaveBeenCalledWith('13085'))
    unmount()
    renderAs(<AccessCodeCard />, 'OWNER')
    expect(screen.getByRole('button', { name: 'Renovar código' })).toBeInTheDocument()
  })

  it('compartir usa la hoja del sistema con el mensaje listo; sin ella, copia', async () => {
    const share = vi.fn(async () => undefined)
    Object.defineProperty(navigator, 'share', { value: share, configurable: true })
    const { unmount } = renderAs(<AccessCodeCard />, 'OWNER')
    fireEvent.click(screen.getByRole('button', { name: 'Compartir' }))
    await waitFor(() => expect(share).toHaveBeenCalledWith({ title: 'Acceso a Negocio', text: 'Para entrar a Negocio en la app Cuentiva: código 13085, tu usuario y tu PIN.' }))
    unmount()
    Object.defineProperty(navigator, 'share', { value: undefined, configurable: true })
    const writeText = vi.fn(async () => undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    renderAs(<AccessCodeCard />, 'OWNER')
    fireEvent.click(screen.getByRole('button', { name: 'Compartir' }))
    await waitFor(() => expect(writeText).toHaveBeenCalledWith('Para entrar a Negocio en la app Cuentiva: código 13085, tu usuario y tu PIN.'))
  })

  it('renovar pide confirmación y llama a la API; cancelar no hace nada', async () => {
    renderAs(<AccessCodeCard />, 'OWNER')
    fireEvent.click(screen.getByRole('button', { name: 'Renovar código' }))
    expect(screen.getByText(/dejará de servir para nuevos ingresos/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(api.renewAccessCode).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Renovar código' }))
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Renovar código' }))
    await waitFor(() => expect(api.renewAccessCode).toHaveBeenCalledWith('b1'))
  })

  it('elegir mi propio código: solo el dueño; se valida en vivo y se guarda con la API', async () => {
    const { unmount } = renderAs(<AccessCodeCard />, 'ADMIN')
    expect(screen.queryByRole('button', { name: 'Elegir mi propio código' })).not.toBeInTheDocument()
    unmount()
    renderAs(<AccessCodeCard />, 'OWNER')
    fireEvent.click(screen.getByRole('button', { name: 'Elegir mi propio código' }))
    const dialog = screen.getByRole('dialog')
    const input = within(dialog).getByLabelText(/^Código nuevo/) as HTMLInputElement
    const save = within(dialog).getByRole('button', { name: 'Guardar código' })
    expect(save).toBeDisabled()
    fireEvent.change(input, { target: { value: '0123' } })
    expect(save).toBeDisabled()
    fireEvent.change(input, { target: { value: '01234' } })
    expect(within(dialog).getByText('Deben ser 5 números y no puede empezar en 0.')).toBeInTheDocument()
    expect(save).toBeDisabled()
    fireEvent.change(input, { target: { value: '5a2-7 1' } })
    expect(input.value).toBe('5271')
    fireEvent.change(input, { target: { value: '52719' } })
    expect(within(dialog).getByText('Se ve bien.')).toBeInTheDocument()
    expect(save).toBeEnabled()
    fireEvent.click(save)
    await waitFor(() => expect(api.setAccessCode).toHaveBeenCalledWith('b1', '52719'))
  })

  it('elegir código: ACCESS_CODE_TAKEN e INVALID_ACCESS_CODE se explican', async () => {
    const { ApiError } = await import('../../api/http')
    renderAs(<AccessCodeCard />, 'OWNER')
    fireEvent.click(screen.getByRole('button', { name: 'Elegir mi propio código' }))
    const dialog = screen.getByRole('dialog')
    fireEvent.change(within(dialog).getByLabelText(/^Código nuevo/), { target: { value: '52719' } })
    vi.mocked(api.setAccessCode).mockRejectedValueOnce(new ApiError(409, 'ACCESS_CODE_TAKEN', 'x'))
    fireEvent.click(within(dialog).getByRole('button', { name: 'Guardar código' }))
    expect(await screen.findByText('Ese código ya lo usa otro negocio, prueba con otro')).toBeInTheDocument()
    vi.mocked(api.setAccessCode).mockRejectedValueOnce(new ApiError(400, 'INVALID_ACCESS_CODE', 'x'))
    fireEvent.click(within(dialog).getByRole('button', { name: 'Guardar código' }))
    expect(await screen.findByText('El código debe tener 5 números y no empezar en 0.')).toBeInTheDocument()
  })
})
