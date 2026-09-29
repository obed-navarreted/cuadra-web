import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Ctx } from '../../auth/context'
import { setLocale } from '../../i18n'
import { errorText } from '../../lib/errors'
import { authValue } from '../../test/renderPanel'
import i18n from '../../i18n'

const api = vi.hoisted(() => ({ calls: [] as { method: string; path: string; body?: unknown }[], reach: { businesses: 3, people: 7 } }))
vi.mock('../../api/http', () => {
  class ApiError extends Error {
    code: string
    status: number
    constructor(status: number, code: string, message: string) {
      super(message)
      this.status = status
      this.code = code
    }
  }
  const make = (method: string) => (path: string, opts?: { body?: unknown }) => ({ method, path, body: opts?.body })
  return {
    ApiError,
    client: { GET: make('GET'), POST: make('POST'), PUT: make('PUT') },
    call: async (r: { method: string; path: string; body?: unknown }) => {
      api.calls.push(r)
      if (r.path.endsWith('/reach')) return api.reach
      if (r.path === '/api/platform/announcements' && r.method === 'POST') return { id: 'a1', state: 'SENT' }
      return []
    },
  }
})

import { ApiError } from '../../api/http'
import ConsolePage from './index'
import { AnnouncementForm } from './AnnouncementForm'

function renderForm(onCreated = vi.fn()) {
  render(<AnnouncementForm onCreated={onCreated} />)
  return onCreated
}
const posts = () => api.calls.filter((c) => c.method === 'POST' && c.path === '/api/platform/announcements')

describe('formulario de anuncios', () => {
  beforeEach(async () => {
    api.calls.length = 0
    await setLocale('es')
  })

  it('no envía un anuncio vacío y dice qué falta', async () => {
    renderForm()
    fireEvent.click(screen.getByRole('button', { name: 'Enviar ahora' }))
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Escribe el título.')
    expect(alert).toHaveTextContent('Escribe el mensaje.')
    expect(posts()).toHaveLength(0)
  })

  it('un título de más de 80 caracteres se rechaza antes de llamar a la API', async () => {
    renderForm()
    fireEvent.change(screen.getByLabelText(/^Título/), { target: { value: 'x'.repeat(81) } })
    fireEvent.change(screen.getByLabelText(/^Mensaje/), { target: { value: 'Hola' } })
    fireEvent.click(screen.getByRole('button', { name: 'Enviar ahora' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('El título pasa de 80 caracteres.')
    expect(posts()).toHaveLength(0)
  })

  it('la franja se desactiva (con su explicación) cuando hay segmento', () => {
    renderForm()
    const banner = screen.getByLabelText(/Mostrar también como franja/)
    expect(banner).toBeEnabled()
    fireEvent.click(banner)
    expect(banner).toBeChecked()
    fireEvent.change(screen.getByLabelText(/^Países/), { target: { value: 'ni' } })
    expect(banner).toBeDisabled()
    expect(banner).not.toBeChecked()
    expect(screen.getByText(/la franja es para todos/i)).toBeInTheDocument()
  })

  it('envía el anuncio con el segmento armado y avisa al terminar', async () => {
    const onCreated = renderForm()
    fireEvent.change(screen.getByLabelText(/^Título/), { target: { value: 'Novedad' } })
    fireEvent.change(screen.getByLabelText(/^Mensaje/), { target: { value: 'Hay cambios' } })
    fireEvent.change(screen.getByLabelText(/^Países/), { target: { value: 'ni, cr' } })
    fireEvent.click(screen.getByRole('button', { name: 'Enviar ahora' }))
    await waitFor(() => expect(posts()).toHaveLength(1))
    expect(posts()[0].body).toMatchObject({ title: 'Novedad', body: 'Hay cambios', audience: 'OWNERS', segment: { countries: ['NI', 'CR'] }, banner: false })
    await waitFor(() => expect(onCreated).toHaveBeenCalled())
    expect(await screen.findByText('Anuncio creado.')).toBeInTheDocument()
  })

  it('"¿A cuántos llega?" muestra la cifra del servidor', async () => {
    renderForm()
    fireEvent.change(screen.getByLabelText(/^Planes/), { target: { value: 'pro' } })
    fireEvent.click(screen.getByRole('button', { name: '¿A cuántos llega?' }))
    expect(await screen.findByText(/Llegaría a 3 negocios y 7 personas/)).toBeInTheDocument()
    expect(api.calls.at(-1)?.body).toEqual({ segment: { plans: ['PRO'] }, audience: 'OWNERS' })
  })
})

describe('acceso a la consola', () => {
  const renderConsole = (me: object | null) =>
    render(
      <Ctx.Provider value={authValue({ me: me as never })}>
        <MemoryRouter initialEntries={['/console']}>
          <ConsolePage />
        </MemoryRouter>
      </Ctx.Provider>,
    )

  it('quien no es admin de plataforma ve "no encontrado"', async () => {
    await setLocale('es')
    renderConsole({ id: 'u', platformAdmin: false })
    expect(await screen.findByText('Página no encontrada')).toBeInTheDocument()
  })

  it('dentro de "Ver como" tampoco hay consola', async () => {
    await setLocale('es')
    renderConsole({ id: 'u', platformAdmin: false, viewAsBusinessId: 'b1' })
    expect(await screen.findByText('Página no encontrada')).toBeInTheDocument()
  })
})

describe('textos de error de la consola', () => {
  it('los códigos de la consola y VIEW_AS_READ_ONLY se traducen (en ambos idiomas)', async () => {
    await setLocale('es')
    expect(errorText(i18n.t.bind(i18n), new ApiError(403, 'VIEW_AS_READ_ONLY', 'x'))).toContain('solo lectura')
    expect(errorText(i18n.t.bind(i18n), new ApiError(400, 'REASON_REQUIRED', 'x'))).toContain('5 letras')
    await setLocale('en')
    expect(errorText(i18n.t.bind(i18n), new ApiError(403, 'VIEW_AS_READ_ONLY', 'x'))).toContain('read-only')
    expect(errorText(i18n.t.bind(i18n), new ApiError(500, 'WHATEVER', 'x'))).toBe(i18n.t('errors.generic'))
    await setLocale('es')
  })
})
