import { render, screen } from '@testing-library/react'
import { act } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import { AuthProvider } from '../auth/AuthProvider'
import i18n, { setLocale } from '../i18n'
import { LoginPage } from './LoginPage'

describe('LoginPage', () => {
  beforeEach(async () => {
    localStorage.clear()
    await act(async () => {
      await setLocale('es')
    })
  })

  it('muestra el nombre y la promesa del producto en español', () => {
    render(
      <MemoryRouter>
        <AuthProvider>
          <LoginPage />
        </AuthProvider>
      </MemoryRouter>,
    )
    expect(screen.getByRole('heading', { name: 'Cuentiva' })).toBeInTheDocument()
    expect(screen.getByText(/La caja, el fiado, los gastos/)).toBeInTheDocument()
  })

  it('cambia a inglés sin recargar y recuerda la elección', async () => {
    render(
      <MemoryRouter>
        <AuthProvider>
          <LoginPage />
        </AuthProvider>
      </MemoryRouter>,
    )
    await act(async () => {
      await setLocale('en')
    })
    expect(screen.getByText(/Your business register, credit/)).toBeInTheDocument()
    expect(localStorage.getItem('cuadra.locale')).toBe('en')
    expect(i18n.language).toBe('en')
  })
})
