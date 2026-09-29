import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { setLocale } from '../../i18n'
import { renderPanel } from '../avisos/testUtils'
import AyudaPage from './index'

type Call = { method: string; path: string; opts?: { body?: Record<string, unknown> } }
const api = vi.hoisted(() => ({ responses: {} as Record<string, unknown>, calls: [] as unknown[] }))
vi.mock('../../api/http', () => {
  const make = (method: string) => (path: string, opts: unknown) => ({ method, path, opts })
  return {
    client: { GET: make('GET'), POST: make('POST'), PUT: make('PUT'), DELETE: make('DELETE') },
    call: async (r: { method: string; path: string }) => {
      api.calls.push(r)
      const v = api.responses[`${r.method} ${r.path}`]
      if (v instanceof Error) throw v
      return v
    },
    downloadFile: vi.fn(),
    ApiError: class ApiError extends Error {
      code: string
      status: number
      constructor(status: number, code: string, message: string) {
        super(message)
        this.status = status
        this.code = code
      }
    },
  }
})

const calls = () => api.calls as Call[]

beforeEach(async () => {
  api.calls.length = 0
  for (const k of Object.keys(api.responses)) delete api.responses[k]
  api.responses['GET /api/config'] = { supportEmail: 'soporte@cuadra.app', donationUrl: 'https://buymeacoffee.com/x', donationMode: 'external_link' }
  await act(async () => {
    await setLocale('es')
  })
})

describe('ayuda y contacto', () => {
  it('muestra el correo de soporte y el café solo cuando hay dirección', async () => {
    renderPanel(<AyudaPage />)
    expect(await screen.findByRole('link', { name: 'soporte@cuadra.app' })).toHaveAttribute('href', 'mailto:soporte@cuadra.app')
    const coffee = screen.getByRole('link', { name: 'Invítame un café' })
    expect(coffee).toHaveAttribute('href', 'https://buymeacoffee.com/x')
    expect(coffee).toHaveAttribute('rel', expect.stringContaining('noopener'))
  })

  it('sin dirección de donación no hay botón', async () => {
    api.responses['GET /api/config'] = { supportEmail: 'soporte@cuadra.app' }
    renderPanel(<AyudaPage />)
    await screen.findByRole('link', { name: 'soporte@cuadra.app' })
    expect(screen.queryByRole('link', { name: 'Invítame un café' })).not.toBeInTheDocument()
  })

  it('no envía un mensaje demasiado corto y lo explica', async () => {
    renderPanel(<AyudaPage />)
    fireEvent.change(await screen.findByLabelText(/^Cuéntanos/), { target: { value: 'hola' } })
    fireEvent.click(screen.getByRole('button', { name: 'Enviar mensaje' }))
    expect(await screen.findByText('Cuéntanos un poco más (mínimo 10 letras).')).toBeInTheDocument()
    expect(calls().some((c) => c.method === 'POST')).toBe(false)
  })

  it('envía el ticket con negocio, idioma y categoría, y confirma con la referencia', async () => {
    api.responses['POST /api/support/tickets'] = { id: 't1', reference: 'CU-1234' }
    renderPanel(<AyudaPage />)
    fireEvent.click(await screen.findByRole('button', { name: 'Un problema' }))
    fireEvent.change(screen.getByLabelText(/^Cuéntanos/), { target: { value: 'No me sincroniza el teléfono de la caja' } })
    fireEvent.change(screen.getByLabelText(/^Correo para responderte/), { target: { value: 'dueno@negocio.com' } })
    fireEvent.click(screen.getByRole('button', { name: 'Enviar mensaje' }))
    expect(await screen.findByText(/Recibimos tu mensaje/)).toBeInTheDocument()
    expect(screen.getByText(/Referencia: CU-1234/)).toBeInTheDocument()
    const post = calls().find((c) => c.method === 'POST')
    expect(post?.opts?.body).toMatchObject({ category: 'PROBLEM', message: 'No me sincroniza el teléfono de la caja', replyToEmail: 'dueno@negocio.com', businessId: 'b1', locale: 'es' })
    expect(JSON.parse(String(post?.opts?.body?.diagnostics))).toMatchObject({ client: 'web' })
    // Se puede mandar otro.
    fireEvent.click(screen.getByRole('button', { name: 'Enviar otro mensaje' }))
    expect(await screen.findByLabelText(/^Cuéntanos/)).toHaveValue('')
  })

  it('si el servidor limita los envíos, lo dice con claridad y conserva el mensaje', async () => {
    const { ApiError } = await import('../../api/http')
    api.responses['POST /api/support/tickets'] = new ApiError(429, 'TOO_MANY_TICKETS', 'x')
    renderPanel(<AyudaPage />)
    fireEvent.change(await screen.findByLabelText(/^Cuéntanos/), { target: { value: 'Necesito ayuda con el cierre' } })
    fireEvent.click(screen.getByRole('button', { name: 'Enviar mensaje' }))
    expect(await screen.findByText(/Enviaste varios mensajes seguidos/)).toBeInTheDocument()
    await waitFor(() => expect(screen.getByLabelText(/^Cuéntanos/)).toHaveValue('Necesito ayuda con el cierre'))
  })

  it('las preguntas frecuentes están en el idioma de la interfaz', async () => {
    renderPanel(<AyudaPage />)
    expect(await screen.findByText('¿Qué pasa si se cae el internet?')).toBeInTheDocument()
    await act(async () => {
      await setLocale('en')
    })
    expect(screen.getByText('What happens if the internet goes down?')).toBeInTheDocument()
  })
})
