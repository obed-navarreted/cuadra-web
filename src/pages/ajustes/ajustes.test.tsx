import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { setLocale } from '../../i18n'
import { polyfillDialog, renderPanel } from '../avisos/testUtils'
import AjustesPage from './index'

type Call = { method: string; path: string; opts?: { params?: { path?: Record<string, string> }; body?: Record<string, unknown> } }
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
const put = () => calls().find((c) => c.method === 'PUT' && c.path === '/api/b/{businessId}')

beforeEach(async () => {
  polyfillDialog()
  api.calls.length = 0
  for (const k of Object.keys(api.responses)) delete api.responses[k]
  Object.assign(api.responses, {
    'GET /api/b/{businessId}/message-templates': [{ id: 't1', kind: 'REMINDER', locale: 'es', body: 'Hola {cliente}, debes {saldo}', rev: 1 }],
    'GET /api/b/{businessId}/members': [{ id: 'm2', displayName: 'Ana', role: 'ADMIN', status: 'ACTIVE', hasGoogle: true }, { id: 'm3', displayName: 'Kevin', role: 'CASHIER', status: 'ACTIVE', hasGoogle: false }],
    'PUT /api/b/{businessId}': {},
  })
  await act(async () => {
    await setLocale('es')
  })
})

describe('ajustes del negocio', () => {
  it('sin cambios no deja guardar; con cambios manda solo lo que cambió y recarga el negocio', async () => {
    const reload = vi.fn(async () => {})
    renderPanel(<AjustesPage />, { reload })
    // Sin cambios no hay barra de guardado (solo el botón de las plantillas, que es aparte).
    expect(screen.queryByText('Tienes cambios sin guardar')).not.toBeInTheDocument()
    fireEvent.click(screen.getByLabelText(/^Exigir un turno abierto para vender/))
    fireEvent.change(screen.getByLabelText(/^Diferencia que exige una nota/), { target: { value: '25.5' } })
    expect(screen.getByText('Tienes cambios sin guardar')).toBeInTheDocument()
    fireEvent.click(screen.getAllByRole('button', { name: 'Guardar cambios' })[0])
    await waitFor(() => expect(put()?.opts?.body).toEqual({ shiftRequired: true, shiftNoteThresholdMinor: 2550 }))
    await waitFor(() => expect(reload).toHaveBeenCalled())
  })

  it('un monto con más decimales que la moneda se rechaza antes de llamar al servidor', async () => {
    renderPanel(<AjustesPage />)
    fireEvent.change(screen.getByLabelText(/^Diferencia que exige una nota/), { target: { value: '10.555' } })
    fireEvent.click(screen.getAllByRole('button', { name: 'Guardar cambios' })[0])
    expect(await screen.findByText('El monto no es válido para la moneda.')).toBeInTheDocument()
    expect(put()).toBeUndefined()
  })

  it('descartar devuelve el formulario a lo guardado y esconde la barra', async () => {
    renderPanel(<AjustesPage />)
    fireEvent.change(screen.getByLabelText(/^Nombre/), { target: { value: 'Otro nombre' } })
    expect(screen.getByText('Tienes cambios sin guardar')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Descartar' }))
    expect(screen.getByLabelText(/^Nombre/)).toHaveValue('Quesería')
    expect(screen.queryByText('Tienes cambios sin guardar')).not.toBeInTheDocument()
    expect(put()).toBeUndefined()
  })

  it('encender un módulo manda solo ese módulo', async () => {
    renderPanel(<AjustesPage />)
    fireEvent.click(screen.getByLabelText(/^Inventario/))
    await waitFor(() => expect(put()?.opts?.body).toEqual({ modules: { inventory: true } }))
  })

  it('un error del servidor se explica por su código', async () => {
    const { ApiError } = await import('../../api/http')
    api.responses['PUT /api/b/{businessId}'] = new ApiError(400, 'INVALID_DAY_CUTOFF', 'x')
    renderPanel(<AjustesPage />)
    fireEvent.change(screen.getByLabelText(/^Hora de corte/), { target: { value: '03:00' } })
    fireEvent.click(screen.getAllByRole('button', { name: 'Guardar cambios' })[0])
    expect(await screen.findByText('La hora de corte no es válida.')).toBeInTheDocument()
  })

  it('un administrador ve los valores sin poder cambiarlos, y no ve el plan ni la zona de peligro', async () => {
    renderPanel(<AjustesPage />, { role: 'ADMIN' })
    expect(screen.getByText(/Solo el dueño cambia estos ajustes/)).toBeInTheDocument()
    expect(screen.getByLabelText(/^Nombre/)).toBeDisabled()
    expect(screen.getByLabelText(/^Fiado/, { selector: 'input' })).toBeDisabled()
    expect(screen.queryByText('Plan y facturación')).not.toBeInTheDocument()
    expect(screen.queryByText('Zona de peligro')).not.toBeInTheDocument()
    // Las plantillas sí las edita.
    expect(await screen.findByLabelText(/^Texto del mensaje/)).not.toBeDisabled()
  })
})

describe('plantillas de mensajes', () => {
  it('muestra el texto propio, avisa de variables inventadas y guarda el cambio', async () => {
    api.responses['PUT /api/b/{businessId}/message-templates/{kind}/{locale}'] = { id: 't1' }
    renderPanel(<AjustesPage />)
    const box = await screen.findByLabelText(/^Texto del mensaje/)
    expect(box).toHaveValue('Hola {cliente}, debes {saldo}')
    expect(screen.getByText(/Hola Marta, debes .*1,?402\.50/)).toBeInTheDocument()
    fireEvent.change(box, { target: { value: 'Hola {cliente} {inventada}' } })
    expect(screen.getByText(/no existen y saldrán tal cual: \{inventada\}/)).toBeInTheDocument()
    const save = screen.getAllByRole('button', { name: 'Guardar cambios' }).at(-1)
    fireEvent.click(save as HTMLElement)
    await waitFor(() => {
      const c = calls().find((x) => x.method === 'PUT' && x.path.includes('message-templates'))
      expect(c?.opts?.params?.path).toMatchObject({ kind: 'REMINDER', locale: 'es' })
      expect(c?.opts?.body).toEqual({ body: 'Hola {cliente} {inventada}' })
    })
  })

  it('restaurar borra el texto propio de ese mensaje e idioma', async () => {
    api.responses['DELETE /api/b/{businessId}/message-templates/{kind}/{locale}'] = undefined
    renderPanel(<AjustesPage />)
    fireEvent.click(await screen.findByRole('button', { name: 'Restaurar el de fábrica' }))
    await waitFor(() => expect(calls().find((c) => c.method === 'DELETE')?.opts?.params?.path).toMatchObject({ kind: 'REMINDER', locale: 'es' }))
  })

  it('otro mensaje sin texto propio usa el de fábrica y no ofrece restaurar', async () => {
    renderPanel(<AjustesPage />)
    fireEvent.click(await screen.findByRole('button', { name: 'Fiado nuevo' }))
    expect(screen.getByLabelText(/^Texto del mensaje/)).toHaveValue('')
    expect(screen.getByText(/Se usa el texto de fábrica/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Restaurar el de fábrica' })).not.toBeInTheDocument()
  })
})

describe('zona de peligro (dueño)', () => {
  it('eliminar el negocio exige escribir su nombre', async () => {
    api.responses['DELETE /api/b/{businessId}'] = undefined
    renderPanel(<AjustesPage />)
    fireEvent.click(await screen.findByRole('button', { name: 'Eliminar el negocio' }))
    const confirm = screen.getAllByRole('button', { name: 'Eliminar el negocio' }).at(-1) as HTMLElement
    expect(confirm).toBeDisabled()
    fireEvent.change(screen.getByLabelText(/Escribe «Quesería»/), { target: { value: 'Quesería' } })
    expect(confirm).toBeEnabled()
    fireEvent.click(confirm)
    await waitFor(() => expect(calls().some((c) => c.method === 'DELETE' && c.path === '/api/b/{businessId}')).toBe(true))
  })

  it('solo ofrece pasar la propiedad a alguien activo con cuenta de Google', async () => {
    renderPanel(<AjustesPage />)
    const select = await screen.findByLabelText('Nueva persona dueña')
    const options = Array.from(select.querySelectorAll('option')).map((o) => o.textContent)
    expect(options).toEqual(['Elige a alguien', 'Ana'])
  })
})
