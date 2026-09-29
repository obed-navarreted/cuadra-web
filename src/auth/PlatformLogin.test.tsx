import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { act } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import i18n, { setLocale } from '../i18n'
import { authValue } from '../test/renderPanel'
import { Ctx, type AuthValue } from './context'
import { PlatformLogin } from './PlatformLogin'

function setup(over: Partial<AuthValue>, onSuccess = vi.fn()) {
  render(
    <MemoryRouter>
      <Ctx.Provider value={authValue(over)}>
        <PlatformLogin onSuccess={onSuccess} />
      </Ctx.Provider>
    </MemoryRouter>,
  )
  return onSuccess
}

async function fill(user = 'root', pw = 'secreto') {
  fireEvent.click(screen.getByRole('button', { name: 'Acceso de plataforma' }))
  fireEvent.change(screen.getByLabelText('Usuario'), { target: { value: user } })
  fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: pw } })
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }))
  })
}

describe('PlatformLogin', () => {
  beforeEach(async () => {
    localStorage.clear()
    await act(async () => {
      await setLocale('es')
    })
  })

  it('está oculto hasta pulsar el enlace y luego muestra usuario y contraseña con autocomplete correcto', () => {
    setup({})
    expect(screen.queryByLabelText('Usuario')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Acceso de plataforma' }))
    expect(screen.getByLabelText('Usuario')).toHaveAttribute('autocomplete', 'username')
    const pw = screen.getByLabelText('Contraseña')
    expect(pw).toHaveAttribute('type', 'password')
    expect(pw).toHaveAttribute('autocomplete', 'current-password')
  })

  it('envía las credenciales, limpia la contraseña y avisa del éxito', async () => {
    const signIn = vi.fn().mockResolvedValue(true)
    const onSuccess = setup({ signInWithPlatform: signIn })
    await fill(' root ', 'secreto')
    expect(signIn).toHaveBeenCalledWith('root', 'secreto')
    expect(onSuccess).toHaveBeenCalled()
    expect(screen.getByLabelText('Contraseña')).toHaveValue('')
    expect(JSON.stringify({ ...localStorage })).not.toContain('secreto')
  })

  it.each([
    ['INVALID_CREDENTIALS', /incorrectos/],
    ['LOCKED', /demasiados intentos, intenta en 15 minutos/i],
    ['RATE_LIMITED', /Demasiadas solicitudes/],
    ['OFFLINE', /Sin conexión/],
    ['NADA_CONOCIDO', /Algo salió mal/],
  ])('muestra el error %s', async (code, text) => {
    const onSuccess = setup({ signInWithPlatform: vi.fn().mockResolvedValue(false), error: code })
    await fill()
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(text))
    expect(onSuccess).not.toHaveBeenCalled()
    expect(screen.getByLabelText('Contraseña')).toHaveValue('')
  })

  it('los textos existen en inglés', async () => {
    await act(async () => {
      await setLocale('en')
    })
    expect(i18n.t('errors.LOCKED')).toMatch(/15 minutes/)
    setup({})
    expect(screen.getByRole('button', { name: 'Platform access' })).toBeInTheDocument()
  })
})
