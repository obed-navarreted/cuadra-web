import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { I18nextProvider } from 'react-i18next'
import i18n, { setLocale } from '../i18n'
import { NAV } from '../layout/nav'
import { SignOutAll } from './SignOutAll'

const api = vi.hoisted(() => ({ calls: [] as { method: string; path: string }[] }))
vi.mock('../api/http', () => ({
  client: { POST: (path: string) => ({ method: 'POST', path }) },
  call: async (r: { method: string; path: string }) => {
    api.calls.push(r)
    return { revoked: 2 }
  },
  ApiError: class ApiError extends Error {},
}))

beforeAll(async () => {
  await act(async () => {
    await setLocale('es')
  })
})

describe('Cerrar todas mis sesiones', () => {
  it('pide confirmar y llama al servidor', async () => {
    render(
      <I18nextProvider i18n={i18n}>
        <SignOutAll />
      </I18nextProvider>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar todas mis sesiones' }))
    expect(api.calls).toHaveLength(0)
    fireEvent.click(screen.getByRole('button', { name: 'Sí, cerrar' }))
    await waitFor(() => expect(api.calls).toEqual([{ method: 'POST', path: '/api/me/sessions/revoke-all' }]))
    expect(await screen.findByRole('status')).toHaveTextContent('se cerraron tus otras sesiones')
  })
})

describe('menú sin planes', () => {
  it('no hay entrada de Plan y facturación', () => {
    expect(NAV.map((n) => n.key)).not.toContain('plan')
  })
})
