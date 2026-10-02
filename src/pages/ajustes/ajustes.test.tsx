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
      if (typeof v === 'function') return (v as (c: unknown) => unknown)(r)
      return v
    },
    downloadFile: vi.fn(),
    ApiError: class ApiError extends Error {
      code: string
      status: number
      count?: number
      totalMinor?: number
      constructor(status: number, code: string, message: string, extra: { count?: number; totalMinor?: number } = {}) {
        super(message)
        this.status = status
        this.code = code
        this.count = extra.count
        this.totalMinor = extra.totalMinor
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
    fireEvent.click(screen.getByLabelText(/^Exigir cliente al fiar/))
    fireEvent.change(screen.getByLabelText(/^Días de vencimiento/), { target: { value: '20' } })
    expect(screen.getByText('Tienes cambios sin guardar')).toBeInTheDocument()
    fireEvent.click(screen.getAllByRole('button', { name: 'Guardar cambios' })[0])
    await waitFor(() => expect(put()?.opts?.body).toEqual({ creditRequiresCustomer: true, creditDefaultDueDays: 20 }))
    await waitFor(() => expect(reload).toHaveBeenCalled())
  })

  it('los días de vencimiento inválidos se rechazan antes de llamar al servidor', async () => {
    renderPanel(<AjustesPage />)
    fireEvent.change(screen.getByLabelText(/^Días de vencimiento/), { target: { value: '-3' } })
    fireEvent.click(screen.getAllByRole('button', { name: 'Guardar cambios' })[0])
    expect(put()).toBeUndefined()
  })

  it('no ofrece el módulo de turnos ni su tarjeta (si el negocio no los exige)', () => {
    renderPanel(<AjustesPage />)
    expect(screen.queryByLabelText(/^Turnos y cierre de caja/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Exigir un turno abierto/)).not.toBeInTheDocument()
  })

  it('cambiar el corte avisa antes de guardar que rige desde la próxima jornada', () => {
    renderPanel(<AjustesPage />)
    expect(screen.queryByText(/Rige desde la próxima jornada/)).not.toBeInTheDocument()
    fireEvent.change(screen.getByLabelText(/^Hora de corte/), { target: { value: '03:00' } })
    expect(screen.getByText(/Rige desde la próxima jornada y no cambia tus días anteriores/)).toBeInTheDocument()
  })

  it('cambiar la zona manda timezone y avisa del horario de verano si aplica', () => {
    renderPanel(<AjustesPage />)
    fireEvent.change(screen.getByLabelText(/^Zona horaria/), { target: { value: 'America/New_York' } })
    expect(screen.getByText(/En tu zona cambia la hora en verano: se recomienda un corte a las 04:00/)).toBeInTheDocument()
    fireEvent.click(screen.getAllByRole('button', { name: 'Guardar cambios' })[0])
    expect(put()?.opts?.body).toEqual({ timezone: 'America/New_York' })
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

  it('muestra la regla pendiente y el historial de reglas de la jornada', () => {
    renderPanel(<AjustesPage />, {
      business: {
        dayRuleEffectiveFrom: '2026-10-01',
        dayRules: [
          { from: '1970-01-01', timezone: 'America/Managua', dayCutoff: '02:00:00' },
          { from: '2026-10-01', timezone: 'America/Managua', dayCutoff: '04:00:00' },
        ],
      },
    })
    expect(screen.getByText(/Nueva regla desde el .*2026/)).toBeInTheDocument()
    expect(screen.getByText('Historial de reglas de la jornada')).toBeInTheDocument()
    expect(screen.getByText('Desde el inicio')).toBeInTheDocument()
    expect(screen.getByText('corte 4:00 AM')).toBeInTheDocument()
  })

  it('apagar el cobro en caja con cuentas pendientes pide confirmar y reenvía con la bandera', async () => {
    const { ApiError } = await import('../../api/http')
    api.responses['PUT /api/b/{businessId}'] = (r: Call) => {
      if (r.opts?.body?.confirmDiscardPending !== true) throw new ApiError(409, 'REGISTER_QUEUE_NOT_EMPTY', 'x', { count: 2, totalMinor: 15000 } as never)
      return {}
    }
    renderPanel(<AjustesPage />, { business: { registerCheckout: true } })
    fireEvent.click(screen.getByLabelText(/^Cobro en caja/))
    fireEvent.click(screen.getAllByRole('button', { name: 'Guardar cambios' })[0])
    expect(await screen.findByText(/Hay 2 cuentas por cobrar en caja \(.*150.*\)\. Si desactivas el cobro en caja, se anularán/)).toBeInTheDocument()
    expect(put()?.opts?.body).toEqual({ registerCheckout: false })
    // Cancelar no manda nada más.
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(calls().filter((c) => c.method === 'PUT')).toHaveLength(1)
    fireEvent.click(screen.getAllByRole('button', { name: 'Guardar cambios' })[0])
    fireEvent.click(await screen.findByRole('button', { name: 'Desactivar y anular' }))
    await waitFor(() => expect(calls().filter((c) => c.method === 'PUT').at(-1)?.opts?.body).toEqual({ registerCheckout: false, confirmDiscardPending: true }))
  })

  it('un error del servidor se explica por su código', async () => {
    const { ApiError } = await import('../../api/http')
    api.responses['PUT /api/b/{businessId}'] = new ApiError(400, 'INVALID_DAY_CUTOFF', 'x')
    renderPanel(<AjustesPage />)
    fireEvent.change(screen.getByLabelText(/^Hora de corte/), { target: { value: '03:00' } })
    fireEvent.click(screen.getAllByRole('button', { name: 'Guardar cambios' })[0])
    expect(await screen.findByText('La hora de corte no es válida.')).toBeInTheDocument()
  })

  it('un administrador edita los ajustes como el dueño, sin plan ni zona de peligro, con una nota de lo que es solo del dueño', async () => {
    const reload = vi.fn(async () => {})
    renderPanel(<AjustesPage />, { role: 'ADMIN', reload })
    expect(screen.queryByText(/Solo el dueño y los administradores cambian estos ajustes/)).not.toBeInTheDocument()
    expect(screen.getByLabelText(/^Nombre/)).not.toBeDisabled()
    expect(screen.getByLabelText(/^Fiado/, { selector: 'input' })).not.toBeDisabled()
    expect(screen.queryByText('Plan y facturación')).not.toBeInTheDocument()
    expect(screen.queryByText('Zona de peligro')).not.toBeInTheDocument()
    expect(screen.getByText(/Solo el dueño puede eliminar el negocio/)).toBeInTheDocument()
    fireEvent.click(screen.getByLabelText(/^Exigir cliente al fiar/))
    fireEvent.click(screen.getAllByRole('button', { name: 'Guardar cambios' })[0])
    await waitFor(() => expect(put()?.opts?.body).toEqual({ creditRequiresCustomer: true }))
    expect(await screen.findByLabelText(/^Texto del mensaje/)).not.toBeDisabled()
  })
})

describe('actividad del negocio', () => {
  it('el administrador ve la pestana Actividad igual que el dueño', () => {
    renderPanel(<AjustesPage />, { role: 'ADMIN' })
    expect(screen.getByRole('link', { name: 'Actividad' })).toBeInTheDocument()
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
