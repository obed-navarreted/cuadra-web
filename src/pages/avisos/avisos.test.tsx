import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { setLocale } from '../../i18n'
import AvisosPage from './index'
import { polyfillDialog, renderPanel } from './testUtils'

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
      return typeof v === 'function' ? (v as (x: unknown) => unknown)(r) : v
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
const NOTIFS = 'GET /api/b/{businessId}/notifications'
const SCHEDS = 'GET /api/b/{businessId}/notification-schedules'
const MEMBERS = 'GET /api/b/{businessId}/members'
const PREFS = 'GET /api/b/{businessId}/notification-preferences'
const SETTINGS = 'GET /api/b/{businessId}/notification-settings'

const schedule = { id: 's1', title: 'Cierre a las 9', body: 'Cuenta la caja', active: true, sent: 3, read: 1, timezone: 'America/Managua', nextRunAt: '2026-09-30T03:00:00Z', audience: { all: true, roles: [], memberIds: [] }, rule: { type: 'DAILY', time: '21:00' } }

beforeEach(async () => {
  polyfillDialog()
  api.calls.length = 0
  for (const k of Object.keys(api.responses)) delete api.responses[k]
  Object.assign(api.responses, {
    [NOTIFS]: { items: [], last: true },
    [SCHEDS]: [],
    [MEMBERS]: [{ id: 'm1', displayName: 'Ana', role: 'ADMIN', status: 'ACTIVE' }],
    [PREFS]: { LOW_STOCK: true, DAILY_SUMMARY: true },
    [SETTINGS]: { quietStart: '21:30:00', quietEnd: '07:00:00', summaryEnabled: false, summaryTime: '21:00:00', staleHours: 24 },
  })
  await act(async () => {
    await setLocale('es')
  })
})

describe('bandeja', () => {
  it('arma el texto en el idioma de la interfaz a partir del tipo y los datos', async () => {
    api.responses[NOTIFS] = {
      last: true,
      items: [
        { id: 'n1', type: 'LOW_STOCK', args: { productName: 'Leche', stockMilli: 13500, unit: 'LB' }, createdAt: '2026-09-29T02:00:00Z', push: true, rev: 1 },
        { id: 'n2', type: 'SHIFT_CLOSED', args: { memberName: 'Kevin', differenceMinor: -1000 }, createdAt: '2026-09-29T02:00:00Z', readAt: '2026-09-29T03:00:00Z', push: true, rev: 2 },
        { id: 'n3', type: 'SALE_DELETED', args: { memberName: 'Ana', totalMinor: 5000 }, createdAt: '2026-09-29T02:00:00Z', push: true, rev: 3 },
      ],
    }
    renderPanel(<AvisosPage />)
    expect(await screen.findByText('Queda poco Leche')).toBeInTheDocument()
    expect(screen.getByText(/Quedan 13,5 lb\./)).toBeInTheDocument()
    expect(screen.getByText(/Kevin cerró la caja\. Faltó .*10\.00/)).toBeInTheDocument()
    expect(screen.getByText(/Ana eliminó una venta de .*50\.00/)).toBeInTheDocument()
    await act(async () => {
      await setLocale('en')
    })
    expect(screen.getByText('Running low: Leche')).toBeInTheDocument()
  })

  it('un aviso de un tipo desconocido muestra el texto del servidor', async () => {
    api.responses[NOTIFS] = { last: true, items: [{ id: 'n1', type: 'FUTURE_TYPE', title: 'Novedad', body: 'Algo nuevo', args: {}, createdAt: '2026-09-29T02:00:00Z', push: true, rev: 1 }] }
    renderPanel(<AvisosPage />)
    expect(await screen.findByText('Novedad')).toBeInTheDocument()
    expect(screen.getByText('Algo nuevo')).toBeInTheDocument()
  })

  it('tocar un aviso sin leer lo marca leído; el enlace lleva a la pantalla del panel', async () => {
    api.responses[NOTIFS] = { last: true, items: [{ id: 'n9', type: 'LOW_STOCK', args: { productName: 'Leche' }, deepLink: 'cuadra://inventario?filtro=bajo', createdAt: '2026-09-29T02:00:00Z', push: true, rev: 1 }] }
    api.responses['POST /api/b/{businessId}/notifications/{id}/read'] = { id: 'n9' }
    renderPanel(<AvisosPage />)
    const link = await screen.findByRole('link', { name: 'Abrir' })
    expect(link).toHaveAttribute('href', '/inventario')
    fireEvent.click(screen.getByText('Queda poco Leche'))
    await waitFor(() => expect(calls().some((c) => c.method === 'POST' && c.opts?.params?.path?.id === 'n9')).toBe(true))
  })

  it('un aviso ya leído no vuelve a pedir nada y "Sin leer" filtra en el servidor', async () => {
    renderPanel(<AvisosPage />)
    fireEvent.click(await screen.findByRole('button', { name: 'Sin leer' }))
    await waitFor(() => expect(calls().filter((c) => c.path.endsWith('/notifications')).length).toBeGreaterThan(1))
    const last = calls().filter((c) => c.path.endsWith('/notifications')).at(-1) as unknown as { opts: { params: { query: { unreadOnly: boolean } } } }
    expect(last.opts.params.query.unreadOnly).toBe(true)
    expect(await screen.findByText('No tienes notificaciones sin leer.')).toBeInTheDocument()
  })
})

describe('programadas', () => {
  async function openTab() {
    renderPanel(<AvisosPage />)
    fireEvent.click(await screen.findByRole('tab', { name: 'Programadas' }))
  }

  it('muestra la regla, la audiencia y el próximo envío en la zona del negocio', async () => {
    api.responses[SCHEDS] = [schedule]
    await openTab()
    expect(await screen.findByText('Cierre a las 9')).toBeInTheDocument()
    expect(screen.getByText('Todos los días a las 21:00')).toBeInTheDocument()
    expect(screen.getByText('Todo el equipo')).toBeInTheDocument()
    expect(screen.getByText(/Próximo envío:.*21:00/)).toBeInTheDocument()
    expect(screen.getByText('Enviados 3 · Leídos 1')).toBeInTheDocument()
  })

  it('pausar manda active=false a esa programación', async () => {
    api.responses[SCHEDS] = [schedule]
    api.responses['POST /api/b/{businessId}/notification-schedules/{id}/active'] = { ...schedule, active: false }
    await openTab()
    fireEvent.click(await screen.findByRole('button', { name: 'Pausar' }))
    await waitFor(() => {
      const c = calls().find((x) => x.path.endsWith('/active'))
      expect(c?.opts?.params?.path?.id).toBe('s1')
      expect(c?.opts?.body).toEqual({ active: false })
    })
  })

  it('el editor no llama al servidor con un borrador inválido y lo explica', async () => {
    await openTab()
    fireEvent.click(await screen.findByRole('button', { name: 'Nueva programación' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Programar' }))
    expect(await screen.findByText('Escribe un título (máximo 100 letras).')).toBeInTheDocument()
    expect(calls().some((c) => c.method === 'PUT')).toBe(false)
  })

  it('programa una repetición semanal con la regla que espera el servidor', async () => {
    api.responses['PUT /api/b/{businessId}/notification-schedules/{id}'] = schedule
    await openTab()
    fireEvent.click(await screen.findByRole('button', { name: 'Nueva programación' }))
    fireEvent.change(await screen.findByLabelText(/^Título/), { target: { value: 'Contar el fondo' } })
    fireEvent.change(screen.getByLabelText(/^Mensaje/), { target: { value: 'Antes de vender' } })
    fireEvent.click(screen.getByRole('button', { name: 'Semanal' }))
    fireEvent.click(screen.getByRole('button', { name: 'L' }))
    fireEvent.click(screen.getByRole('button', { name: 'Programar' }))
    await waitFor(() => {
      const put = calls().find((c) => c.method === 'PUT' && c.path.endsWith('/notification-schedules/{id}'))
      expect(put?.opts?.body).toMatchObject({ title: 'Contar el fondo', body: 'Antes de vender', audience: { all: true }, rule: { type: 'WEEKLY', time: '09:00', days: [1] } })
      expect(put?.opts?.params?.path?.id).toMatch(/[0-9a-f-]{36}/)
    })
  })

  it('"Ahora" usa el envío inmediato y un error del servidor se explica por su código', async () => {
    const { ApiError } = await import('../../api/http')
    api.responses['POST /api/b/{businessId}/notification-schedules/{id}/send-now'] = new ApiError(400, 'INVALID_AUDIENCE', 'x')
    await openTab()
    fireEvent.click(await screen.findByRole('button', { name: 'Nueva programación' }))
    fireEvent.change(await screen.findByLabelText(/^Título/), { target: { value: 'Hola' } })
    fireEvent.change(screen.getByLabelText(/^Mensaje/), { target: { value: 'Equipo' } })
    fireEvent.click(screen.getByRole('button', { name: 'Ahora' }))
    fireEvent.click(screen.getByRole('button', { name: 'Enviar ahora' }))
    expect(await screen.findByText('Elige a quién va dirigido el aviso.')).toBeInTheDocument()
    expect(calls().some((c) => c.method === 'POST' && c.path.endsWith('/send-now'))).toBe(true)
  })
})

describe('preferencias', () => {
  it('apagar un tipo lo manda al servidor y lo deja apagado', async () => {
    api.responses['PUT /api/b/{businessId}/notification-preferences'] = { LOW_STOCK: false }
    renderPanel(<AvisosPage />)
    fireEvent.click(await screen.findByRole('tab', { name: 'Preferencias' }))
    const box = await screen.findByRole('checkbox', { name: 'Queda poco de un producto' })
    fireEvent.click(box)
    await waitFor(() => expect(calls().find((c) => c.method === 'PUT' && c.path.endsWith('/notification-preferences'))?.opts?.body).toEqual({ type: 'LOW_STOCK', enabled: false }))
    expect(box).not.toBeChecked()
  })

  it('un admin ve las reglas del negocio pero no las cambia', async () => {
    renderPanel(<AvisosPage />, { role: 'ADMIN' })
    fireEvent.click(await screen.findByRole('tab', { name: 'Preferencias' }))
    expect(await screen.findByText('Solo el dueño cambia estas reglas.')).toBeInTheDocument()
    expect(screen.getByLabelText('Silencio desde')).toBeDisabled()
    expect(screen.queryByRole('button', { name: 'Guardar' })).not.toBeInTheDocument()
  })

  it('el dueño guarda las reglas con horas válidas y el recordatorio de turno apagado no se manda', async () => {
    api.responses['PUT /api/b/{businessId}/notification-settings'] = {}
    renderPanel(<AvisosPage />)
    fireEvent.click(await screen.findByRole('tab', { name: 'Preferencias' }))
    fireEvent.change(await screen.findByLabelText('Silencio desde'), { target: { value: '22:00' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    await waitFor(() => {
      const put = calls().find((c) => c.method === 'PUT' && c.path.endsWith('/notification-settings'))
      expect(put?.opts?.body).toEqual({ quietStart: '22:00', quietEnd: '07:00', summaryEnabled: false, summaryTime: '21:00', shiftReminderTime: undefined, staleHours: 24 })
    })
  })
})
