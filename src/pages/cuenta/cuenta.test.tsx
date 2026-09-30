import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { client } from '../../api/http'
import { Ctx, type AuthValue } from '../../auth/context'
import { setLocale } from '../../i18n'
import { ok } from '../../test/renderPanel'
import { DeleteAccountDialog } from './DeleteAccountDialog'
import { DeleteAccountInfo } from './DeleteAccountInfo'
import { deleteWord, ownedBusinesses } from './logic'

vi.mock('../../api/http', async (importOriginal) => ({ ...(await importOriginal<typeof import('../../api/http')>()), client: { GET: vi.fn(), DELETE: vi.fn() } }))

function withAuth(ui: React.ReactElement, memberships: { role: string; businessName: string; businessId: string }[], signOut = vi.fn(async () => {})) {
  const value = { memberships, signOut } as unknown as AuthValue
  return render(
    <MemoryRouter>
      <Ctx.Provider value={value}>{ui}</Ctx.Provider>
    </MemoryRouter>,
  )
}

describe('eliminar mi cuenta', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    await setLocale('es')
    HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) { this.open = true }
    HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) { this.open = false }
  })

  it('quien es dueño primero elimina sus negocios: se explica y se lleva a Ajustes', () => {
    withAuth(<DeleteAccountDialog open onClose={() => {}} />, [{ role: 'OWNER', businessName: 'Quesería', businessId: 'b' }])
    expect(screen.getByText(/Eres dueño de: Quesería/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Ir a Eliminar negocio' })).toHaveAttribute('href', '/ajustes')
    expect(screen.queryByRole('button', { name: /para siempre/ })).not.toBeInTheDocument()
  })

  it('sin negocios propios, se confirma escribiendo la palabra y se borra la cuenta', async () => {
    const signOut = vi.fn(async () => {})
    vi.mocked(client.DELETE).mockImplementation((() => ok(null)) as never)
    withAuth(<DeleteAccountDialog open onClose={() => {}} />, [{ role: 'ADMIN', businessName: 'Otra', businessId: 'b' }], signOut)
    const confirm = screen.getByRole('button', { name: 'Eliminar mi cuenta para siempre' })
    expect(confirm).toBeDisabled()
    fireEvent.change(screen.getByLabelText('Escribe ELIMINAR para confirmar'), { target: { value: 'eliminar' } })
    fireEvent.click(confirm)
    await waitFor(() => expect(client.DELETE).toHaveBeenCalledWith('/api/me'))
    await waitFor(() => expect(signOut).toHaveBeenCalled())
  })

  it('la página pública explica cómo eliminar la cuenta, en español y en inglés', () => {
    render(
      <MemoryRouter>
        <DeleteAccountInfo lang="es" />
      </MemoryRouter>,
    )
    expect(screen.getByRole('heading', { name: 'Eliminar tu cuenta y tus datos de Cuentiva' })).toBeInTheDocument()
    expect(screen.getAllByText(/a los 30 días/).length).toBeGreaterThan(0)
    expect(screen.getByRole('link', { name: 'English' })).toHaveAttribute('href', '/delete-account')
  })

  it('la versión en inglés no depende del idioma del navegador', () => {
    render(
      <MemoryRouter>
        <DeleteAccountInfo lang="en" />
      </MemoryRouter>,
    )
    expect(screen.getByRole('heading', { name: 'Delete your Cuentiva account and data' })).toBeInTheDocument()
    expect(ownedBusinesses([{ role: 'OWNER' }, { role: 'ADMIN' }] as never)).toHaveLength(1)
    expect(deleteWord('en')).toBe('DELETE')
  })
})
